const axios = require('axios');

/**
 * 飞书数据同步云函数 (通用版) - 部署于环境 cloud1-d2gpq0fat0dd3c17f
 */
exports.main = async (event, context) => {
  const APP_ID = 'cli_a97758782db95cc9';
  const APP_SECRET = '5OSZq6riErmGUOiCT1CV8b5DZtIOhddy';
  const DEFAULT_APP_TOKEN = 'XKHGbfUJSaKp8Kse4MQczYyTnNg';
  const DEFAULT_TABLE_ID = 'tblOaCkcls4jOxwS';

  try {
    // --- Handle CORS Preflight ---
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    };

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : event;
    const records = body.fields || [];
    const appToken = body.appToken || DEFAULT_APP_TOKEN;
    const tableId = body.tableId || DEFAULT_TABLE_ID;

    if (records.length === 0) return { success: false, message: '没有数据' };

    const tokenRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: APP_ID,
      app_secret: APP_SECRET
    });

    const tenantAccessToken = tokenRes.data.tenant_access_token;
    if (!tenantAccessToken) throw new Error('获取飞书 Token 失败');

    // --- Step 1: Get actual field names from Feishu to handle mismatches (like trailing spaces) ---
    const fieldsRes = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      { headers: { Authorization: `Bearer ${tenantAccessToken}` } }
    );

    const actualFields = fieldsRes.data.data?.items || [];
    console.log('--- 飞书表中的实际字段 ---', actualFields.map(f => `"${f.field_name}"`));

    const findActualFieldName = (name) => {
      const cleanName = name.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      // Exact match first
      const exact = actualFields.find(f => f.field_name === name);
      if (exact) return exact.field_name;
      // Case-insensitive / trim match
      const fuzzy = actualFields.find(f => f.field_name.trim() === cleanName);
      return fuzzy ? fuzzy.field_name : name;
    };

    const feishuRecords = records.map(item => {
      const matchedFields = {};
      for (const key in item) {
        const actualKey = findActualFieldName(key);
        matchedFields[actualKey] = item[key];
      }
      return { fields: matchedFields };
    });

    const writeUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;
    console.log('--- 发送至飞书 Payload (已匹配字段) ---', JSON.stringify({ records: feishuRecords }));
    
    const writeRes = await axios.post(writeUrl, { records: feishuRecords }, {
      headers: {
        'Authorization': `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('--- 飞书原始响应 ---', JSON.stringify(writeRes.data));

    if (writeRes.data.code !== 0) {
       return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: '飞书失败: ' + writeRes.data.msg,
            detail: writeRes.data.error || writeRes.data
          })
       };
    }

    const result = { success: true, message: `同步成功！上传 ${records.length} 条。` };
    
    return {
      isBase64Encoded: false,
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('--- 云函数内部错误 ---', error);
    const errResult = { success: false, message: '系统错误: ' + error.message };
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(errResult)
    };
  }
};
