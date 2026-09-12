/**
 * I-CA Web Signer & Local PKI Plugin Connector
 * Connects web frontend to local I-CA Token Signer service / WebSocket / REST API
 */

import { parseX509Certificate } from './certParser';

export const COMMON_PLUGIN_PORTS = [15888, 8080, 8443, 23456, 9000, 8088, 8888];

/**
 * Check if I-CA Web Signer Plugin is running on localhost
 * @param {number|string} customPort 
 * @returns {Promise<{ ok: boolean, port: number, message: string }>}
 */
export async function checkPluginStatus(customPort = 15888) {
  const portsToTry = customPort ? [Number(customPort), ...COMMON_PLUGIN_PORTS.filter(p => p !== Number(customPort))] : COMMON_PLUGIN_PORTS;

  for (const port of portsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      // Try HTTP ping
      const res = await fetch(`http://127.0.0.1:${port}/ping`, { 
        method: "GET",
        signal: controller.signal 
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && (res.ok || res.status === 200 || res.status === 404)) {
        return { ok: true, port, message: `Đã kết nối I-CA Signer Plugin tại cổng ${port}` };
      }

      // Try root status check
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 1200);
      const res2 = await fetch(`http://127.0.0.1:${port}/status`, { 
        method: "GET",
        signal: controller2.signal 
      }).catch(() => null);

      clearTimeout(timeoutId2);

      if (res2 && (res2.ok || res2.status === 200)) {
        return { ok: true, port, message: `Đã kết nối I-CA Signer Plugin tại cổng ${port}` };
      }
    } catch (e) {}
  }

  return { 
    ok: false, 
    port: Number(customPort) || 15888, 
    message: "Chưa tìm thấy I-CA Web Signer Plugin đang chạy trên máy (cổng 15888 / 8080)" 
  };
}

/**
 * Read certificate directly from USB Token via local plugin
 * @param {number|string} port 
 * @returns {Promise<{ ok: boolean, cert?: object, raw?: any, error?: string }>}
 */
export async function readCertificatesFromPlugin(port = 15888) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const endpoints = [
      `http://127.0.0.1:${port}/getCertificates`,
      `http://127.0.0.1:${port}/api/getCertificates`,
      `http://127.0.0.1:${port}/certificates`,
      `http://127.0.0.1:${port}/cert`
    ];

    let data = null;
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { 
          method: "GET", 
          headers: { "Content-Type": "application/json" },
          signal: controller.signal 
        });
        if (resp.ok) {
          data = await resp.json().catch(() => null);
          if (data) break;
        }
      } catch (err) {}
    }

    clearTimeout(timeoutId);

    if (!data) {
      throw new Error(`Không đọc được chứng thư từ I-CA Plugin tại cổng ${port}`);
    }

    // Process returned certificate
    let certRaw = data.certificate || data.cert || (Array.isArray(data) ? data[0] : data);
    if (typeof certRaw === "string") {
      const parsed = parseX509Certificate(certRaw);
      return { ok: true, cert: parsed, raw: data };
    } else if (certRaw && certRaw.subject) {
      return {
        ok: true,
        cert: {
          signerName: certRaw.subject || certRaw.commonName || certRaw.cn,
          mst: certRaw.mst || certRaw.taxId || "",
          caProvider: certRaw.issuer || "I-CA (I-CA Public CA)",
          serialNumber: certRaw.serialNumber || "",
          validFrom: certRaw.validFrom || "",
          validTo: certRaw.validTo || ""
        },
        raw: data
      };
    }

    return { ok: true, raw: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Request USB Token to sign a document / payload (triggers Windows I-CA Token Manager PIN popup)
 * @param {object} signPayload 
 * @param {number|string} port 
 * @returns {Promise<{ ok: boolean, signature?: string, signedPdf?: string, error?: string }>}
 */
export async function signWithPlugin(signPayload, port = 15888) {
  try {
    const endpoints = [
      `http://127.0.0.1:${port}/sign`,
      `http://127.0.0.1:${port}/api/sign`,
      `http://127.0.0.1:${port}/signPdf`,
      `http://127.0.0.1:${port}/signHash`
    ];

    let result = null;
    let lastError = null;

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sign",
            payload: signPayload,
            reason: signPayload.reason || "I am approving this document with my legally binding signature",
            location: signPayload.location || "Bà Rịa - Vũng Tàu"
          })
        });

        if (resp.ok) {
          result = await resp.json().catch(() => null);
          if (result && (result.ok || result.signature || result.signedData)) break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!result) {
      throw new Error(lastError ? lastError.message : `Không thể gửi yêu cầu ký đến I-CA Plugin (cổng ${port}). Vui lòng đảm bảo I-CA Web Signer đang chạy.`);
    }

    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
