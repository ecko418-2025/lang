const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 飞书配置
const APP_ID = 'cli_a97758782db95cc9';
const APP_SECRET = '5OSZq6riErmGUOiCT1CV8b5DZtIOhddy';
const DEFAULT_APP_TOKEN = 'XKHGbfUJSaKp8Kse4MQczYyTnNg';
const DEFAULT_TABLE_ID = 'tblOaCkcls4jOxwS';

app.post('/api/feishu-upload', async (req, res) => {
    console.log('--- 收到同步请求 ---');
    try {
        const body = req.body;
        const records = body.fields || [];
        const appToken = body.appToken || DEFAULT_APP_TOKEN;
        const tableId = body.tableId || DEFAULT_TABLE_ID;

        if (records.length === 0) {
            return res.json({ success: false, message: '没有数据可同步' });
        }

        // 1. 获取飞书 Token
        const tokenRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: APP_ID,
            app_secret: APP_SECRET
        });

        const tenantAccessToken = tokenRes.data.tenant_access_token;
        if (!tenantAccessToken) throw new Error('获取飞书 Token 失败');

        // 2. 批量写入
        const feishuRecords = records.map(item => ({ fields: item }));
        const writeUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`;
        
        const writeRes = await axios.post(writeUrl, { records: feishuRecords }, {
            headers: {
                'Authorization': `Bearer ${tenantAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (writeRes.data.code !== 0) {
            return res.json({ success: false, message: '飞书同步失败: ' + writeRes.data.msg });
        }

        console.log(`成功同步 ${records.length} 条数据到飞书`);
        res.json({ success: true, message: `同步成功！上传 ${records.length} 条。` });
    } catch (error) {
        console.error('同步报错:', error.message);
        res.status(500).json({ success: false, message: '服务器错误: ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`狼人杀同步助手本地代理已启动: http://localhost:${port}`);
    console.log(`同步接口地址: http://localhost:${port}/api/feishu-upload`);
});
