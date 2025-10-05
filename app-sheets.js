/* =========================================================================
 * app-sheets.js  —  JSONP-only transport to Google Apps Script
 * -------------------------------------------------------------------------
 * - يعتمد JSONP في كل الحالات (file:// و http/https) لتفادي CORS.
 * - جميع الطلبات GET عبر ?action=...&data=BASE64&callback=fn
 * - يحتاج GAS يدعم doGet(callback + data Base64) — (تم تزويدك بكوده).
 *
 * يعتمد على:
 *   GAS actions:
 *     listAssessments, saveAssessment, deleteAssessmentCascade,
 *     listPhoneLogs, savePhoneLog, deletePhoneLog
 *
 * ملاحظات:
 * - يقرأ رابط الـ Web App من window.AppData.getWebAppUrl() أو window.WEBAPP_URL
 * - يدعم إرسال كائنات كبيرة عبر data=base64 (UTF-8 آمن)
 * - يحافظ على نفس أسماء الدوال الموجودة عندك حتى ما تغيّر بقية الملفات
 * ========================================================================= */

(function () {
  'use strict';

  /* ==============================
   * إعداد الرابط
   * ============================== */
  function getBaseUrl() {
    try {
      if (window.AppData && typeof window.AppData.getWebAppUrl === 'function') {
        const u = String(window.AppData.getWebAppUrl() || '').trim();
        if (u) return u;
      }
    } catch {}
    if (typeof window.WEBAPP_URL === 'string' && window.WEBAPP_URL) {
      return String(window.WEBAPP_URL).trim();
    }
    return '';
  }

  const BASE_URL = getBaseUrl();
  if (!BASE_URL) {
    console.warn('[app-sheets] WEBAPP_URL is not set — set window.WEBAPP_URL or AppData.getWebAppUrl().');
  }

  /* ==============================
   * أدوات عامة
   * ============================== */

  // Base64 UTF-8 آمن
  function b64EncodeUtf8(str) {
    try {
      return btoa(unescape(encodeURIComponent(String(str))));
    } catch (e) {
      return '';
    }
  }
  function encodeData(obj) {
    try {
      return b64EncodeUtf8(JSON.stringify(obj || {}));
    } catch (e) {
      return '';
    }
  }

  function buildUrl(params) {
    // نبني URL على BASE_URL ونضيف الباراميترات
    const u = new URL(BASE_URL);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      u.searchParams.set(k, typeof v === 'string' ? v : String(v));
    });
    return u.toString();
  }

  /* ==============================
   * JSONP core
   * ============================== */
  function jsonp(params = {}, { timeoutMs = 15000 } = {}) {
    if (!BASE_URL) return Promise.reject(new Error('WEBAPP_URL is not set'));
    return new Promise((resolve, reject) => {
      const cbName = '__jsonp_cb_' + Math.random().toString(36).slice(2);
      let script = null;
      let timer = null;
      let done = false;

      function cleanup() {
        if (done) return;
        done = true;
        try { delete window[cbName]; } catch {}
        if (timer) { clearTimeout(timer); timer = null; }
        if (script && script.parentNode) {
          try { script.parentNode.removeChild(script); } catch {}
        }
      }

      window[cbName] = (payload) => {
        cleanup();
        resolve(payload);
      };

      const url = buildUrl(Object.assign({}, params, { callback: cbName }));
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP network error'));
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, timeoutMs);

      document.head.appendChild(script);
    });
  }

  // راحة استخدام
  function request(params) { return jsonp(params); }

  /* ==============================
   * دوال عالية المستوى (Assessments)
   * ============================== */

  async function fetchAssessments() {
    const res = await request({ action: 'listAssessments' });
    return Array.isArray(res) ? res : (res && res.rows) || [];
  }

  async function saveAssessment(record) {
    const payload = record || {};
    const res = await request({ action: 'saveAssessment', data: encodeData(payload) });
    return res || { ok: true };
  }

  /**
   * updateAssessmentFields(id, patch)
   * - اختصار آمن لتحديث حقول محددة في سجل Assessment (Upsert).
   * - يحافظ على نفس اسم الدالة كما عندك.
   */
  async function updateAssessmentFields(id, patch) {
    if (!id) throw new Error('id is required');
    const data = Object.assign({ id: String(id) }, patch || {});
    return await saveAssessment(data);
  }

  async function deleteAssessmentCascade(id) {
    if (!id) throw new Error('id is required');
    const res = await request({ action: 'deleteAssessmentCascade', id: String(id) });
    return res || { ok: true };
  }

  /* ==============================
   * دوال عالية المستوى (Phone Logs)
   * ============================== */

  async function fetchPhoneLogs(patientId) {
    const params = { action: 'listPhoneLogs' };
    if (patientId != null && patientId !== '') params.id = String(patientId);
    const res = await request(params);
    return Array.isArray(res) ? res : (res && res.rows) || [];
  }

  /**
   * savePhoneLog(log)
   * - يدعم upsert بالـ log_id (لو أرسلته الواجهة).
   * - يتقبّل كل الحقول التي يدعمها الخادم.
   */
  async function savePhoneLog(log) {
    const payload = log || {};
    const res = await request({ action: 'savePhoneLog', data: encodeData(payload) });
    return res || { ok: true };
  }

  /**
   * deletePhoneLog({ id, log_id, call_time })
   * - يحذف صفًا واحدًا من PhoneLogs عبر المفتاح log_id (id/call_time اختياريين).
   */
  async function deletePhoneLog({ id, log_id, call_time }) {
    const payload = {
      id: id != null ? String(id) : '',
      log_id: String(log_id || ''),
      call_time: call_time || '',
    };
    if (!payload.log_id) throw new Error('log_id is required');
    const res = await request({ action: 'deletePhoneLog', data: encodeData(payload) });
    return res || { ok: true };
  }

  /* ==============================
   * كشف الواجهة
   * ============================== */

  const API = {
    // Assessments
    fetchAssessments,
    saveAssessment,
    updateAssessmentFields,
    deleteAssessmentCascade,
    // Phone
    fetchPhoneLogs,
    savePhoneLog,
    deletePhoneLog,
  };

  if (typeof window !== 'undefined') {
    window.SheetsAPI = API;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
