DROP TABLE IF EXISTS invitation_code;
CREATE TABLE invitation_code (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  create_time INTEGER NOT NULL,
  update_time INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  email TEXT NOT NULL DEFAULT '',
  UNIQUE(code)
);

CREATE INDEX idx_code ON invitation_code(code);
CREATE INDEX idx_status ON invitation_code(status);
CREATE INDEX idx_email ON invitation_code(email);