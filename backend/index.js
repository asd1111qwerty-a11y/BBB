const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const SECRET = 'bubble_secret_key';
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Static files - skins
app.use('/skins/guilds', express.static(path.join(__dirname, '../Ogar3/client/skins/guilds')));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // sesuaikan password MySQL kamu
    database: 'bubble_am'
});

db.connect((err) => {
    if (err) {
        console.log('[DB] Connection failed:', err.message);
        return;
    }
    console.log('[DB] Connected to MySQL');
});

function addGuildLog(guildId, description) {
    db.query('INSERT INTO guild_logs (guild_id, description, created_at) VALUES (?, ?, NOW())', [guildId, description]);
}

// Middleware auth
function authenticateToken(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.json({ success: false, message: 'No token' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (e) {
        return res.json({ success: false, message: 'Invalid token' });
    }
}

// POST /register
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.json({ success: false, message: 'All fields are required!' });
    if (username.length < 3) return res.json({ success: false, message: 'Username must be at least 3 characters!' });
    if (password.length < 6) return res.json({ success: false, message: 'Password must be at least 6 characters!' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: false, message: 'Invalid email address!' });
    const hash = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                if (err.sqlMessage && err.sqlMessage.includes('email')) {
                    return res.json({ success: false, message: 'Email already in use!' });
                }
                return res.json({ success: false, message: 'Username already in use!' });
            }
            return res.json({ success: false, message: 'Registration failed!' });
        }
        res.json({ success: true, message: 'Registration successful! Please login.' });
    });
});

// POST /login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: 'Username and password are required!' });
    db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, message: 'Username not found!' });
        const user = results[0];
        if (user.role === 'banned') return res.json({ success: false, message: 'Your account is banned!' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ success: false, message: 'Wrong password!' });
        db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    });
});

// GET /profile
app.get('/profile', authenticateToken, (req, res) => {
    db.query('SELECT id, username, email, xp, level, last_login, role, color, account_type, skin, active_skin, guild_id FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        const u = results[0];
        if (!u.guild_id) return res.json({ success: true, user: u });
        db.query('SELECT g.id, g.name, g.tag, g.skin, g.type FROM guilds g WHERE g.id = ?', [u.guild_id], (err2, gResults) => {
            u.guild = (!err2 && gResults && gResults.length > 0) ? gResults[0] : null;
            res.json({ success: true, user: u });
        });
    });
});

// POST /changepassword
app.post('/changepassword', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) 
        return res.json({ success: false, message: 'All fields are required!' });
    if (newPassword.length < 6) 
        return res.json({ success: false, message: 'Password minimal 6 karakter!' });

    db.query('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, results) => {
        if (err || results.length === 0) 
            return res.json({ success: false, message: 'User not found!' });

        const match = await bcrypt.compare(currentPassword, results[0].password);
        if (!match) 
            return res.json({ success: false, message: 'Current password salah!' });

        const hash = await bcrypt.hash(newPassword, 10);
        db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id], (err2) => {
            if (err2) return res.json({ success: false, message: 'Gagal update password!' });
            res.json({ success: true });
        });
    });
});

// POST /addtoptime
app.post('/addtoptime', authenticateToken, (req, res) => {
    const { minutes, server } = req.body;
    if (!minutes || minutes < 1) return res.json({ success: false });

    db.query(
        'SELECT id, minutes FROM top_times WHERE user_id = ? AND server = ?',
        [req.user.id, server],
        (err, results) => {
            if (err) return res.json({ success: false });

            if (results.length === 0) {
                // Insert baru
                db.query(
                    'INSERT INTO top_times (user_id, username, server, minutes) SELECT id, username, ?, ? FROM users WHERE id = ?',
                    [server, minutes, req.user.id],
                    () => res.json({ success: true })
                );
            } else if (minutes > results[0].minutes) {
                // Update kalau lebih tinggi
                db.query(
                    'UPDATE top_times SET minutes = minutes + ?, updated_at = NOW() WHERE id = ?',
                    [minutes, results[0].id],
                    () => res.json({ success: true })
                );
            } else {
                res.json({ success: true }); // tidak update, score lama lebih tinggi
            }
        }
    );
});

// GET /topscore/:server  (replace yang lama)
app.get('/topscore/:server', (req, res) => {
    const server = decodeURIComponent(req.params.server);
    const period = req.query.period || 'all';

    let dateFilter = '';
    if (period === 'today') dateFilter = 'AND DATE(t.updated_at) = CURDATE()';
    else if (period === 'week') dateFilter = 'AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';

    db.query(
        `SELECT t.username, t.minutes FROM top_times t
         WHERE t.server = ? ${dateFilter}
         ORDER BY t.minutes DESC LIMIT 20`,
        [server],
        (err, results) => {
            if (err) return res.json({ success: false });
            res.json({ success: true, scores: results });
        }
    );
});

// GET /role/:username
app.get('/role/:username', (req, res) => {
    var username = decodeURIComponent(req.params.username).trim();
    var bracketClose = username.indexOf('] ');
    if (bracketClose !== -1) username = username.substring(bracketClose + 2).trim();
    if (!username) return res.json({ roles: ['user'], role: 'user', color: null });

    db.query('SELECT role, color FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) return res.json({ roles: ['user'], role: 'user', color: null });

        // SET column returns comma-separated string
        var rolesStr = results[0].role || 'user';
        var roles = rolesStr.split(',').map(r => r.trim()).filter(Boolean);

        // Prioritas: banned > admin > mod > noname > user
        var primaryRole = 'user';
        if (roles.includes('banned')) primaryRole = 'banned';
        else if (roles.includes('admin')) primaryRole = 'admin';
        else if (roles.includes('mod')) primaryRole = 'mod';
        else if (roles.includes('noname')) primaryRole = 'noname';

        res.json({ roles, role: primaryRole, color: results[0].color });
    });
});

// POST /addxp
app.post('/addxp', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.json({ success: false });
    try {
        const decoded = jwt.verify(token, SECRET);
        const { xp } = req.body;
        db.query('SELECT xp, level FROM users WHERE id = ?', [decoded.id], (err, results) => {
            if (err || results.length === 0) return res.json({ success: false });
            let newXP = results[0].xp + xp;
            let newLevel = results[0].level;
            function xpNeeded(level) {
                if (level <= 5) return 100 + (level - 1) * 50;
                if (level <= 10) return 300 + (level - 5) * 100;
                if (level <= 20) return 800 + (level - 10) * 200;
                if (level <= 35) return 2800 + (level - 20) * 350;
                return 8050 + (level - 35) * 500;
            }
            const MAX_LEVEL = 125;
            while (newXP >= xpNeeded(newLevel) && newLevel < MAX_LEVEL) {
                newXP -= xpNeeded(newLevel);
                newLevel++;
            }
            if (newLevel >= MAX_LEVEL) { newLevel = MAX_LEVEL; newXP = 0; }
            db.query('UPDATE users SET xp = ?, level = ? WHERE id = ?', [newXP, newLevel, decoded.id], () => {
                res.json({ success: true, xp: newXP, level: newLevel });
            });
        });
    } catch (e) { res.json({ success: false }); }
});

// POST /setskin
app.post('/setskin', authenticateToken, (req, res) => {
    const { skin_type } = req.body;
    db.query('UPDATE users SET active_skin = ? WHERE id = ?', [skin_type, req.user.id], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// Multer setup untuk upload skin
// Multer setup untuk upload skin
const skinStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../Ogar3/client/skins');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        db.query('SELECT username FROM users WHERE id = ?', [req.user.id], (err, results) => {
            const username = (!err && results.length > 0) ? results[0].username : req.user.id.toString();
            cb(null, username + '.png');
        });
    }
});
const uploadSkin = multer({ storage: skinStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// POST /uploadskin
app.post('/uploadskin', authenticateToken, (req, res) => {
    // Cek points dulu sebelum upload
    db.query('SELECT username, points FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        if (results[0].points < 150) return res.json({ success: false, message: 'Not enough points!' });

        const skinName = results[0].username;
        // Baru upload file
        uploadSkin.single('skin')(req, res, (err2) => {
            if (err2 || !req.file) return res.json({ success: false, message: 'Upload failed!' });
            db.query('UPDATE users SET skin = ?, points = points - 150 WHERE id = ?', [skinName, req.user.id], (err3) => {
                if (err3) return res.json({ success: false });
                res.json({ success: true, skin: skinName });
            });
        });
    });
});

// GET /guildchat
app.get('/guildid/:username', (req, res) => {
    var username = decodeURIComponent(req.params.username).trim();
    db.query('SELECT guild_id FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) return res.json({ guild_id: null });
        res.json({ guild_id: results[0].guild_id });
    });
});

// POST /guildsetrole
app.post('/guildsetrole', authenticateToken, (req, res) => {
    const { member_id, role } = req.body;
    db.query('SELECT guild_id FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || !me[0].guild_id) return res.json({ success: false });
        db.query('SELECT username FROM users WHERE id = ?', [member_id], (e, r) => {
            const uname = (!e && r.length > 0) ? r[0].username : 'Unknown';
            db.query('UPDATE users SET guild_role = ? WHERE id = ? AND guild_id = ?', [role, member_id, me[0].guild_id], () => {
                const action = role === 'staff' ? uname + ' was promoted to Staff' : uname + ' was demoted to Member';
                addGuildLog(me[0].guild_id, action);
                res.json({ success: true });
            });
        });
    });
});

// POST /deleteguild
app.post('/deleteguild', authenticateToken, (req, res) => {
    db.query('SELECT guild_id, guild_role FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || !me[0].guild_id || me[0].guild_role !== 'leader') return res.json({ success: false });
        const guildId = me[0].guild_id;

        // Ambil skin guild dulu sebelum delete
        db.query('SELECT skin FROM guilds WHERE id = ?', [guildId], (err2, gResult) => {
            // Hapus file skin kalau ada
            if (!err2 && gResult.length > 0 && gResult[0].skin) {
                const skinPath = path.join(__dirname, '../Ogar3/client/skins', gResult[0].skin + '.png');
                if (fs.existsSync(skinPath)) {
                    try { fs.unlinkSync(skinPath); } catch (e) { }
                }
            }

            db.query('UPDATE users SET guild_id = NULL, guild_role = "member" WHERE guild_id = ?', [guildId], () => {
                db.query('DELETE FROM guilds WHERE id = ?', [guildId], () => {
                    res.json({ success: true });
                });
            });
        });
    });
});

// POST /editguild
app.post('/editguild', authenticateToken, (req, res) => {
    const { type, description } = req.body;
    if (!type || !['public', 'private'].includes(type)) return res.json({ success: false, message: 'Invalid type!' });
    db.query('SELECT guild_id, guild_role FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || !me[0].guild_id || me[0].guild_role !== 'leader') return res.json({ success: false });
        const desc = description !== undefined ? description : null;
        db.query('UPDATE guilds SET type = ?, description = ? WHERE id = ?', [type, desc, me[0].guild_id], (err2) => {
            if (err2) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

// POST /joinguild
app.post('/joinguild', authenticateToken, (req, res) => {
    const { guild_id } = req.body;
    if (!guild_id) return res.json({ success: false, message: 'Guild ID required!' });

    db.query('SELECT guild_id, username FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || me.length === 0) return res.json({ success: false });
        if (me[0].guild_id) return res.json({ success: false, message: 'You already have a guild!' });

        db.query('SELECT id, type FROM guilds WHERE id = ?', [guild_id], (err2, gResult) => {
            if (err2 || gResult.length === 0) return res.json({ success: false, message: 'Guild not found!' });

            const guild = gResult[0];

            if (guild.type === 'private') {
                // Cek ada invite pending
                db.query('SELECT id FROM guild_invites WHERE to_user_id = ? AND guild_id = ? AND status = "pending"',
                    [req.user.id, guild_id], (err3, invites) => {
                        if (err3 || invites.length === 0)
                            return res.json({ success: false, message: 'You need an invite to join this guild!' });

                        db.query('UPDATE users SET guild_id = ?, guild_role = "member" WHERE id = ?', [guild_id, req.user.id], () => {
                            db.query('UPDATE guild_invites SET status = "accepted" WHERE to_user_id = ? AND guild_id = ? AND status = "pending"',
                                [req.user.id, guild_id]);
                            addGuildLog(guild_id, me[0].username + ' joined the guild via invite');
                            res.json({ success: true });
                        });
                    });
            } else {
                db.query('UPDATE users SET guild_id = ?, guild_role = "member" WHERE id = ?', [guild_id, req.user.id], (err3) => {
                    if (err3) return res.json({ success: false });
                    addGuildLog(guild_id, me[0].username + ' joined the guild');
                    res.json({ success: true });
                });
            }
        });
    });
});

// GET /guildlogs/:id
app.get('/guildlogs/:id', (req, res) => {
    db.query('SELECT * FROM guild_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id], (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, logs: results || [] });
    });
});

// GET /guilds
app.get('/guilds', (req, res) => {
    db.query('SELECT g.id, g.name, g.tag, g.skin, g.type, u.username as leader, COUNT(m.id) as members FROM guilds g JOIN users u ON g.leader_id = u.id LEFT JOIN users m ON m.guild_id = g.id GROUP BY g.id', (err, results) => {
        if (err) return res.json({ success: false });
        res.json({ success: true, guilds: results });
    });
});

// Multer untuk guild skin
const guildSkinStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../Ogar3/client/skins');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'guild_tmp_' + req.user.id + '.png');
    }
});
const uploadGuildSkin = multer({ storage: guildSkinStorage, limits: { fileSize: 2 * 1024 * 1024 } });

// POST /createguild
app.post('/createguild', authenticateToken, (req, res) => {
    uploadGuildSkin.single('skin')(req, res, (uploadErr) => {
        const { name, tag, type } = req.body;
        if (!name || !tag) return res.json({ success: false, message: 'Name and tag are required!' });

        db.query('SELECT points, guild_id FROM users WHERE id = ?', [req.user.id], (err, results) => {
            if (err || results.length === 0) return res.json({ success: false });
            if (results[0].guild_id) return res.json({ success: false, message: 'You already have a guild!' });
            if (results[0].points < 50) return res.json({ success: false, message: 'Not enough points! Need 50 points.' });

            db.query('INSERT INTO guilds (name, tag, type, leader_id) VALUES (?, ?, ?, ?)',
                [name, tag, type || 'public', req.user.id], (err2, result) => {
                    if (err2) return res.json({ success: false, message: 'Guild already exists or error!' });

                    const guildId = result.insertId;
                    let skinName = null;

                    // Rename skin file kalau ada
                    if (req.file) {
                        skinName = 'guilds/guild_' + guildId;
                        const dir = path.join(__dirname, '../Ogar3/client/skins/guilds');
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        const oldPath = req.file.path;
                        const newPath = path.join(dir, 'guild_' + guildId + '.png');
                        fs.renameSync(oldPath, newPath);
                    }

                    // Update guilds set skin, kurangi points, set user jadi leader
                    db.query('UPDATE guilds SET skin = ? WHERE id = ?', [skinName, guildId], () => {
                        db.query('UPDATE users SET guild_id = ?, guild_role = "leader", points = points - 50 WHERE id = ?',
                            [guildId, req.user.id], () => {
                                res.json({ success: true });
                            });
                    });
                });
        });
    });
});

// POST /leaveguild
app.post('/leaveguild', authenticateToken, (req, res) => {
    db.query('SELECT guild_id, username FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (!err && me[0] && me[0].guild_id) {
            addGuildLog(me[0].guild_id, me[0].username + ' left the guild');
        }
        db.query('UPDATE users SET guild_id = NULL, guild_role = "member" WHERE id = ?', [req.user.id], () => {
            res.json({ success: true });
        });
    });
});

// POST /inviteplayer
app.post('/inviteplayer', authenticateToken, (req, res) => {
    const { username } = req.body;
    db.query('SELECT guild_id, guild_role FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || !me[0].guild_id) return res.json({ success: false, message: 'You dont have a guild!' });
        if (me[0].guild_role !== 'leader' && me[0].guild_role !== 'staff') 
            return res.json({ success: false, message: 'No permission!' });
        
        db.query('SELECT id, guild_id FROM users WHERE username = ?', [username], (err2, results) => {
            if (err2 || results.length === 0) return res.json({ success: false, message: 'User not found!' });
            if (results[0].guild_id) return res.json({ success: false, message: 'User already has a guild!' });
            
            const toUserId = results[0].id;
            const guildId = me[0].guild_id;
            
            // Cek apakah sudah ada invite pending
            db.query('SELECT id FROM guild_invites WHERE to_user_id = ? AND guild_id = ? AND status = "pending"',
                [toUserId, guildId], (err3, existing) => {
                    if (existing && existing.length > 0) 
                        return res.json({ success: false, message: 'Already invited!' });
                    
                    // Ambil nama inviter
                    db.query('SELECT username FROM users WHERE id = ?', [req.user.id], (err4, inviter) => {
                        const fromName = (!err4 && inviter.length > 0) ? inviter[0].username : 'Someone';
                        
                        db.query('INSERT INTO guild_invites (guild_id, from_user, to_user_id) VALUES (?, ?, ?)',
                            [guildId, fromName, toUserId], (err5) => {
                                if (err5) return res.json({ success: false, message: 'Failed to send invite!' });
                                addGuildLog(guildId, fromName + ' invited ' + username);
                                res.json({ success: true });
                            });
                    });
                });
        });
    });
});

// GET /notifications - ambil semua notifikasi user
app.get('/notifications', authenticateToken, (req, res) => {
    db.query(
        `SELECT gi.id, gi.guild_id, gi.from_user, gi.created_at, g.name as guild_name, g.tag as guild_tag, g.skin as guild_skin
         FROM guild_invites gi
         JOIN guilds g ON g.id = gi.guild_id
         WHERE gi.to_user_id = ? AND gi.status = 'pending'
         ORDER BY gi.created_at DESC`,
        [req.user.id],
        (err, results) => {
            if (err) return res.json({ success: false });
            res.json({ success: true, notifications: results });
        }
    );
});

// POST /acceptinvite
app.post('/acceptinvite', authenticateToken, (req, res) => {
    const { invite_id } = req.body;
    db.query('SELECT * FROM guild_invites WHERE id = ? AND to_user_id = ? AND status = "pending"',
        [invite_id, req.user.id], (err, results) => {
            if (err || results.length === 0) return res.json({ success: false, message: 'Invite not found!' });
            
            const invite = results[0];
            
            // Cek user belum punya guild
            db.query('SELECT guild_id, username FROM users WHERE id = ?', [req.user.id], (err2, me) => {
                if (me[0].guild_id) return res.json({ success: false, message: 'You already have a guild!' });
                
                // Masukkan ke guild
                db.query('UPDATE users SET guild_id = ?, guild_role = "member" WHERE id = ?',
                    [invite.guild_id, req.user.id], (err3) => {
                        if (err3) return res.json({ success: false });
                        
                        // Update status invite
                        db.query('UPDATE guild_invites SET status = "accepted" WHERE id = ?', [invite_id]);
                        
                        // Hapus invite pending lain untuk user ini
                        db.query('UPDATE guild_invites SET status = "rejected" WHERE to_user_id = ? AND status = "pending"', 
                            [req.user.id]);
                        
                        addGuildLog(invite.guild_id, me[0].username + ' joined the guild via invite');
                        res.json({ success: true });
                    });
            });
        });
});

// POST /rejectinvite
app.post('/rejectinvite', authenticateToken, (req, res) => {
    const { invite_id } = req.body;
    db.query('UPDATE guild_invites SET status = "rejected" WHERE id = ? AND to_user_id = ?',
        [invite_id, req.user.id], (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
});

// GET /notifcount - jumlah notif pending (untuk badge)
app.get('/notifcount', authenticateToken, (req, res) => {
    db.query('SELECT COUNT(*) as count FROM guild_invites WHERE to_user_id = ? AND status = "pending"',
        [req.user.id], (err, results) => {
            if (err) return res.json({ success: false, count: 0 });
            res.json({ success: true, count: results[0].count });
        });
});

// POST /kickmember
app.post('/kickmember', authenticateToken, (req, res) => {
    const { member_id } = req.body;
    db.query('SELECT guild_id FROM users WHERE id = ?', [req.user.id], (err, me) => {
        if (err || !me[0].guild_id) return res.json({ success: false });
        db.query('SELECT username FROM users WHERE id = ?', [member_id], (e, r) => {
            const uname = (!e && r.length > 0) ? r[0].username : 'Unknown';
            db.query('UPDATE users SET guild_id = NULL, guild_role = "member" WHERE id = ? AND guild_id = ?', [member_id, me[0].guild_id], () => {
                addGuildLog(me[0].guild_id, uname + ' was kicked from the guild');
                res.json({ success: true });
            });
        });
    });
});

// GET /guild/:id
app.get('/guild/:id', (req, res) => {
    db.query('SELECT g.*, u.username as leader_name FROM guilds g JOIN users u ON g.leader_id = u.id WHERE g.id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        const guild = results[0];
        db.query('SELECT id, username, guild_role, level FROM users WHERE guild_id = ?', [guild.id], (err2, members) => {
            guild.members = members || [];
            res.json({ success: true, guild });
        });
    });
});

// GET /points
app.get('/points', authenticateToken, (req, res) => {
    db.query('SELECT points FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        res.json({ success: true, points: results[0].points });
    });
});

app.post('/addpoints', authenticateToken, (req, res) => {
    const { points } = req.body;
    db.query('UPDATE users SET points = points + ? WHERE id = ?', [points || 0.2, req.user.id], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// POST /setcolor
app.post('/setcolor', authenticateToken, (req, res) => {
    const { color } = req.body;
    db.query('UPDATE users SET color = ? WHERE id = ?', [color, req.user.id], (err) => {
        if (err) return res.json({ success: false });
        res.json({ success: true });
    });
});

// POST /upgradetopremium
app.post('/upgradetopremium', authenticateToken, (req, res) => {
    db.query('SELECT points FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        if (results[0].points < 2) return res.json({ success: false, message: 'Not enough points!' });
        db.query('UPDATE users SET account_type = "premium", points = points - 2 WHERE id = ?', [req.user.id], (err2) => {
            if (err2) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

// POST /topscore
app.post('/topscore', authenticateToken, (req, res) => {
    const { score, server } = req.body;
    db.query('SELECT top_score FROM users WHERE id = ?', [req.user.id], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false });
        if (!results[0].top_score || score > results[0].top_score) {
            db.query('UPDATE users SET top_score = ? WHERE id = ?', [score, req.user.id], () => {
                res.json({ success: true });
            });
        } else {
            res.json({ success: true });
        }
    });
});

app.listen(PORT, () => {
    console.log('[Backend] Running on port ' + PORT);
});