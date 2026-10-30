CREATE TABLE terms (
 id TEXT PRIMARY KEY, settings TEXT NOT NULL CHECK(json_valid(settings)),
 sections_revision INTEGER NOT NULL DEFAULT 1, schedule_revision INTEGER NOT NULL DEFAULT 1,
 students_revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT
);
INSERT INTO terms(id,settings) VALUES('2026-2','{"title":"개인 시간표","schoolName":"첨단고등학교","academicYear":2026,"semester":2,"periods":{"월":7,"화":7,"수":6,"목":7,"금":7},"fixedPeriods":[{"day":"월","period":1,"label":"창체"},{"day":"수","period":5,"label":"창체"},{"day":"수","period":6,"label":"창체"}]}');
CREATE TABLE app_state(id INTEGER PRIMARY KEY CHECK(id=1),active_term TEXT NOT NULL REFERENCES terms(id),revision INTEGER NOT NULL DEFAULT 1,history_revision INTEGER NOT NULL DEFAULT 1);
INSERT INTO app_state(id,active_term) VALUES(1,'2026-2');
CREATE TABLE students (
 term_id TEXT NOT NULL REFERENCES terms(id), id TEXT NOT NULL, source_key TEXT NOT NULL,
 grade TEXT NOT NULL CHECK(grade IN ('1','2','3')),class_num TEXT NOT NULL,number TEXT NOT NULL,
 name TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('재학','전출','자퇴','휴학','졸업')),
 note TEXT NOT NULL DEFAULT '',manual_fields TEXT NOT NULL CHECK(json_valid(manual_fields)),updated_at TEXT,
 PRIMARY KEY(term_id,id)
);
CREATE UNIQUE INDEX active_student_number ON students(term_id,grade,class_num,number) WHERE status='재학';
CREATE INDEX student_source ON students(term_id,source_key);
CREATE INDEX student_class ON students(term_id,grade,class_num,status);
CREATE TABLE sections (
 term_id TEXT NOT NULL REFERENCES terms(id),id TEXT NOT NULL,grade TEXT NOT NULL CHECK(grade IN ('1','2','3')),
 subject TEXT NOT NULL,code TEXT NOT NULL,normalized_key TEXT NOT NULL,source_key TEXT NOT NULL,room TEXT NOT NULL,short_name TEXT NOT NULL,manual_fields TEXT NOT NULL DEFAULT '[]',
 PRIMARY KEY(term_id,id),UNIQUE(term_id,normalized_key)
);
CREATE INDEX section_subject ON sections(term_id,grade,subject,code);
CREATE TABLE assignments (
 term_id TEXT NOT NULL,student_id TEXT NOT NULL,subject TEXT NOT NULL,code TEXT NOT NULL,section_id TEXT,
 PRIMARY KEY(term_id,student_id,subject),
 FOREIGN KEY(term_id,student_id) REFERENCES students(term_id,id) ON DELETE CASCADE
);
CREATE INDEX assignment_section ON assignments(term_id,section_id,student_id);
CREATE INDEX assignment_subject ON assignments(term_id,subject,code,student_id);
CREATE INDEX assignment_student_active ON assignments(term_id,student_id) WHERE code!='';
CREATE TABLE teacher_rows(term_id TEXT NOT NULL REFERENCES terms(id),row_number INTEGER NOT NULL,cells TEXT NOT NULL CHECK(json_valid(cells)),PRIMARY KEY(term_id,row_number));
CREATE TABLE teachers(term_id TEXT NOT NULL REFERENCES terms(id),id TEXT NOT NULL,name TEXT NOT NULL,PRIMARY KEY(term_id,id));
CREATE TABLE lessons(term_id TEXT NOT NULL,teacher_id TEXT NOT NULL,day TEXT NOT NULL,period INTEGER NOT NULL,subject TEXT NOT NULL,room TEXT NOT NULL,PRIMARY KEY(term_id,teacher_id,day,period),FOREIGN KEY(term_id,teacher_id) REFERENCES teachers(term_id,id) ON DELETE CASCADE);
CREATE TABLE overrides(term_id TEXT NOT NULL REFERENCES terms(id),slot_key TEXT NOT NULL,teacher TEXT NOT NULL,day TEXT NOT NULL,period INTEGER NOT NULL,section_id TEXT NOT NULL,PRIMARY KEY(term_id,slot_key));
CREATE TABLE blocks(term_id TEXT NOT NULL REFERENCES terms(id),grade TEXT NOT NULL,day TEXT NOT NULL,period INTEGER NOT NULL,block TEXT NOT NULL,PRIMARY KEY(term_id,grade,day,period));
CREATE TABLE history(id TEXT PRIMARY KEY,at TEXT NOT NULL,term_id TEXT NOT NULL REFERENCES terms(id),action TEXT NOT NULL,target TEXT NOT NULL,before_value TEXT,after_value TEXT,backup_id TEXT);
CREATE INDEX history_term ON history(term_id,at DESC);
CREATE TABLE backups(id TEXT PRIMARY KEY,at TEXT NOT NULL,term_id TEXT NOT NULL REFERENCES terms(id),label TEXT NOT NULL,bytes INTEGER NOT NULL,parts INTEGER NOT NULL);
CREATE INDEX backup_term ON backups(term_id,at DESC);
CREATE TABLE backup_parts(backup_id TEXT NOT NULL REFERENCES backups(id),part INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(backup_id,part));
CREATE TABLE credentials(role TEXT PRIMARY KEY CHECK(role IN ('teacher','admin')),password_hash TEXT NOT NULL,epoch INTEGER NOT NULL DEFAULT 1);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,role TEXT NOT NULL REFERENCES credentials(role),epoch INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE login_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX limit_expiry ON login_limits(expires_at);
CREATE TABLE write_guards(id TEXT PRIMARY KEY,expected_revision INTEGER NOT NULL,expected_term TEXT NOT NULL,token_hash TEXT NOT NULL,at INTEGER NOT NULL);
CREATE TRIGGER check_write_guard BEFORE INSERT ON write_guards BEGIN
 SELECT CASE WHEN NEW.expected_revision != (SELECT revision FROM app_state WHERE id=1) OR NEW.expected_term != (SELECT active_term FROM app_state WHERE id=1) THEN RAISE(ABORT,'revision_conflict') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN credentials c ON c.role=s.role AND c.epoch=s.epoch WHERE s.token_hash=NEW.token_hash AND s.role='admin' AND s.expires_at>NEW.at) THEN RAISE(ABORT,'auth_required') END;
END;
