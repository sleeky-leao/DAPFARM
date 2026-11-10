const session = require("express-session");
const db = require("./database");

// Create sessions table
db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL
    )
`);

class SQLiteSessionStore extends session.Store {

    get(sid, callback) {
        try {
            const row = db.prepare(
                "SELECT * FROM sessions WHERE sid = ?"
            ).get(sid);

            if (!row || row.expires_at <= Date.now()) {
                db.prepare(
                    "DELETE FROM sessions WHERE sid = ?"
                ).run(sid);

                return callback(null, null);
            }

            callback(null, JSON.parse(row.sess));

        } catch (error) {
            callback(error);
        }
    }

    set(sid, sess, callback) {
        try {
            const expiresAt = sess.cookie.expires
                ? new Date(sess.cookie.expires).getTime()
                : Date.now() + (sess.cookie.maxAge || 7200000);

            db.prepare(`
                INSERT INTO sessions (sid, sess, expires_at)
                VALUES (?, ?, ?)
                ON CONFLICT(sid) DO UPDATE SET
                    sess = excluded.sess,
                    expires_at = excluded.expires_at
            `).run(sid, JSON.stringify(sess), expiresAt);

            if (callback) callback(null);

        } catch (error) {
            if (callback) callback(error);
        }
    }

    destroy(sid, callback) {
        try {
            db.prepare(
                "DELETE FROM sessions WHERE sid = ?"
            ).run(sid);

            if (callback) callback(null);

        } catch (error) {
            if (callback) callback(error);
        }
    }

    touch(sid, sess, callback) {
        try {
            const expiresAt = sess.cookie.expires
                ? new Date(sess.cookie.expires).getTime()
                : Date.now() + (sess.cookie.maxAge || 7200000);

            db.prepare(`
                UPDATE sessions
                SET expires_at = ?
                WHERE sid = ?
            `).run(expiresAt, sid);

            if (callback) callback(null);

        } catch (error) {
            if (callback) callback(error);
        }
    }
}

module.exports = SQLiteSessionStore;