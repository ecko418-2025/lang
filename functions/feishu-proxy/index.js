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
    const body = event.body ? JSON.parse(event.body) : event;
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

    const feishuRecords = records.map(item => ({ fields: item }));
    const writeUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;
    
    const writeRes = await axios.post(writeUrl, { records: feishuRecords }, {
      headers: {
        'Authorization': `Bearer ${tenantAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (writeRes.data.code !== 0) return { success: false, message: '飞书失败: ' + writeRes.data.msg };

    return { success: true, message: `同步成功！上传 ${records.length} 条。` };
  } catch (error) {
    return { success: false, message: '错误: ' + error.message };
  }
};
