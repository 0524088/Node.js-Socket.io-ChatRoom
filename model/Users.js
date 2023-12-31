import pool   from '../sql.js';
import crypto from 'crypto';
const hash = crypto.getHashes();
const Users = {
    // 確認帳號狀態
    checkAccount: async (data) => {
        try {
            const conn = await pool.getConnection(); // 从连接池获取连接
            let sql = "select * from users where account = ?";
            const [result] = await conn.query(sql, [data.account]); // [result] 返回的结果中提取第一个元素，并将其赋值给名为 result 的变量
            conn.release(); // 释放连接回连接池
            return result;
        }
        catch (error) {
            console.error(error);
        }
    },

    // 登入
    login: async (data) => {
        try {
            const conn = await pool.getConnection(); // 从连接池获取连接
            let sql = "update users set token = ? where account = ?";
            let token = crypto.randomBytes(80).toString('base64').slice(0, 79);
            const [result] = await conn.query(sql, [token, data.account]);
            conn.release();
            return {
                token: token,
                result: result
            };
        }
        catch (error) {
            console.error(error);
        }
    },

    // 登出
    logout: async (token) => {
        try {
            const conn = await pool.getConnection(); // 从连接池获取连接
            let sql = "update users set token = ? where token = ?";
            const [result] = await conn.query(sql, [null, token]);
            conn.release();

            // 執行成功
            if(result.affectedRows > 0) {
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(error);
        }
    }
}

export default Users;
