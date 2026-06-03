-- Script để thêm cột idTramTron vào bảng NguoiDung
-- Chạy script này trên SQL Server để fix lỗi "Invalid column name 'idTramTron'"

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'NguoiDung' AND COLUMN_NAME = 'idTramTron'
)
BEGIN
    ALTER TABLE NguoiDung ADD idTramTron INT NULL;
    PRINT 'Đã thêm cột idTramTron vào bảng NguoiDung';
END
ELSE
BEGIN
    PRINT 'Cột idTramTron đã tồn tại trong bảng NguoiDung';
END

-- Thêm khóa ngoại nếu cần
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'NguoiDung' AND COLUMN_NAME = 'idTramTron'
)
AND NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_NAME = 'NguoiDung' AND CONSTRAINT_NAME = 'FK_NguoiDung_TramTron'
)
BEGIN
    ALTER TABLE NguoiDung
    ADD CONSTRAINT FK_NguoiDung_TramTron
    FOREIGN KEY (idTramTron) REFERENCES TramTron(id);
    PRINT 'Đã thêm khóa ngoại FK_NguoiDung_TramTron';
END
