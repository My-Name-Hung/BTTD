### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend Kế toán – Điều phối – Kho

```bash
cd frontend-ke-toan
npm install
npm run dev
```

### Frontend Lãnh đạo

```bash
cd frontend-lanh-dao
npm install
npm run dev
```

### Tài khoản mặc định

| Vai trò     | Tên đăng nhập | Mật khẩu     |
| ----------- | ------------- | ------------ |
| Admin       | admin         | Admin@123    |
| Kế toán     | ketoan        | Ketoan@123   |
| Điều phối   | dieuphoi      | Dieuphoi@123 |
| Lãnh đạo    | lanhdao       | Lanhdao@123  |
| Quản lý kho | kho           | Kho@123      |
| Sales       | sales         | Sales@123    |
| Tài xế      | taixe         | Taixe@123    |
| Kỹ thuật    | kythuat       | Kythuat@123  |

# 1. Trên máy local: build lại

cd C:\Users\.Freelancer\BTTD\frontend-ke-toan
npm run build

# 2. Upload lại

scp -P 24700 -r dist/\* root@103.75.187.222:/var/www/bttd/frontend-ke-toan/

# 3. Trên VPS: reload Nginx

sudo nginx -t && sudo systemctl reload nginx


Domain: bttd.ximangtaydo.vn
  Type:   unauthorized
  Detail: 113.161.208.240