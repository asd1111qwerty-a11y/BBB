var Packet = require('./packet');
var Commands = require('./modules/CommandList');
var LastMsg;
var SpamBlock;

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocol = 0;
    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function (message) {
    function stobuf(buf) {
        var length = buf.length;
        var arrayBuf = new ArrayBuffer(length);
        var view = new Uint8Array(arrayBuf);
        for (var i = 0; i < length; i++) {
            view[i] = buf[i];
        }
        return view.buffer;
    }

    // Discard empty messages
    if (message.length == 0) {
        return;
    }

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    switch (packetId) {
        case 0:
            var skin = "";
            var nick = "";
            var i = 1;

            // Cek apakah ada skin prefix '%'
            if (i < view.byteLength && view.getUint8(i) === 37) { // 37 = '%'
                i++; // skip '%'
                // Baca skin sebagai ASCII 1-byte sampai null byte
                while (i < view.byteLength) {
                    var b = view.getUint8(i);
                    i++;
                    if (b === 0) break; // null terminator skin
                    skin += String.fromCharCode(b);
                }
            }

            // Baca nick sebagai UTF-16
            var maxLen = 60 * 2;
            var nickStart = i;
            while (i < view.byteLength && i <= nickStart + maxLen) {
                var charCode = view.getUint16(i, true);
                i += 2;
                if (charCode === 0) break;
                nick += String.fromCharCode(charCode);
            }

            // Parse warna dari nick format: #RRGGBB|nick
            this.socket.playerTracker.skin = skin;
            this.setNickname(nick, skin);
            break;
        case 1:
            // Spectate mode
            if (this.socket.playerTracker.cells.length <= 0) {
                // Make sure client has no cells
                this.gameServer.switchSpectator(this.socket.playerTracker);
                this.socket.playerTracker.spectate = true;
            }
            break;
        case 16:
            var client = this.socket.playerTracker;
            if (view.byteLength == 13) {
                client.mouse.x = view.getInt32(1, true);
                client.mouse.y = view.getInt32(5, true);
            } else if (view.byteLength == 9) {
                client.mouse.x = view.getInt16(1, true);
                client.mouse.y = view.getInt16(3, true);
            } else if (view.byteLength == 21) {
                client.mouse.x = view.getFloat64(1, true);
                client.mouse.y = view.getFloat64(9, true);
            }
            break;
        case 17:
            // Space Press - Split cell
            this.pressSpace = true;
            break;
        case 18:
            // Q Key Pressed
            this.pressQ = true;
            break;
        case 19:
            // Q Key Released
            break;
        case 21:
            // W Press - Eject mass
            this.pressW = true;
            break;
        case 80:
            // Some Code Agar.io Sends us o.O
            var yada = "";
            for (var i = 1; i < view.byteLength; i++) {
                var charCode = view.getUint8(i, true);
                yada += String.fromCharCode(charCode);
            }
        case 90:
            // Send Server Info
            var player = 0;
            var client;
            for (var i = 0; i < this.gameServer.clients.length; i++) {
                client = this.gameServer.clients[i].playerTracker;
                if ((client.disconnect <= 0) && (client.spectate == false)) ++player;
            }
            this.socket.sendPacket(new Packet.ServerInfo(process.uptime().toFixed(0), player, this.gameServer.config.borderRight, this.gameServer.config.foodMaxAmount, this.gameServer.config.serverGamemode));
            break;
        case 255:
            // Connection Start
            if (view.byteLength == 5) {
                var c = this.gameServer.config,
                    player = 0,
                    client;
                for (var i = 0; i < this.gameServer.clients.length; i++) {
                    client = this.gameServer.clients[i].playerTracker;
                    if ((client.disconnect <= 0) && (client.spectate == false)) ++player;
                }
                // Boot Player if Server Full
                if (player > c.serverMaxConnections) {
                    this.socket.sendPacket(new Packet.ServerMsg(93));
                    this.socket.close();
                }
                this.socket.sendPacket(new Packet.SetBorder(c.borderLeft, c.borderRight, c.borderTop, c.borderBottom));
                this.socket.sendPacket(new Packet.ServerInfo(process.uptime().toFixed(0), player, c.borderRight, c.foodMaxAmount, this.gameServer.config.serverGamemode));
                break;
            }
            break;
        case 99:
            var message = "",
                maxLen = this.gameServer.config.chatMaxMessageLength * 2,
                offset = 2,
                flags = view.getUint8(1);

            if (flags & 2) { offset += 4; }
            if (flags & 4) { offset += 8; }
            if (flags & 8) { offset += 16; }

            for (var i = offset; i < view.byteLength && i <= maxLen; i += 2) {
                var charCode = view.getUint16(i, true);
                if (charCode == 0) {
                    break;
                }
                message += String.fromCharCode(charCode);
            }
            var date = new Date(),
                hour = date.getHours();
            if ((date - this.socket.playerTracker.cTime) < 500) {
                break;
            }

            this.socket.playerTracker.cTime = date;
            var rawName = this.socket.playerTracker.name || '';
            var wname = rawName.indexOf('\n') !== -1 ? rawName.split('\n')[1] : rawName;
            var zname = wname;
            if (wname == "") wname = "Spectator";

            if (this.gameServer.config.serverAdminPass != '') {
                var passkey = "/rcon " + this.gameServer.config.serverAdminPass + " ";
                if (message.substr(0, passkey.length) == passkey) {
                    var cmd = message.substr(passkey.length, message.length);
                    console.log("\u001B[36m" + wname + ": \u001B[0missued a remote console command: " + cmd);
                    var split = cmd.split(" "),
                        first = split[0].toLowerCase(),
                        execute = this.gameServer.commands[first];
                    if (typeof execute != 'undefined') {
                        execute(this.gameServer, split);
                    } else {
                        console.log("Invalid Command!");
                    }
                    break;
                } else if (message.substr(0, 6) == "/rcon ") {
                    console.log("\u001B[36m" + wname + ": \u001B[0missued a remote console command but used a wrong pass key!");
                    break;
                }
            }

            // Admin command via chat - cek role dari backend
            if (message.charAt(0) === '/' && message.substr(0, 6) !== '/rcon ' && message.substr(0, 3).toLowerCase() !== '/g ' && message.toLowerCase() !== '/g') {
                var self = this;
                var adminName = wname;
                if (adminName.indexOf('] ') !== -1) {
                    adminName = adminName.split('] ')[1] || adminName;
                }
                var http = require('http');
                var reqOptions = {
                    hostname: 'localhost',
                    port: 3001,
                    path: '/role/' + encodeURIComponent(adminName),
                    method: 'GET'
                };
                var roleReq = http.request(reqOptions, function (roleRes) {
                    var body = '';
                    roleRes.on('data', function (chunk) { body += chunk; });
                    roleRes.on('end', function () {
                        try {
                            var data = JSON.parse(body);

                            // Helper buat server chat packet langsung ke socket
                            function sendServerMsg(name, r, g, b, msg) {
                                var nick = name;
                                var buf = new ArrayBuffer(9 + 2 * nick.length + 2 * msg.length);
                                var view = new DataView(buf);
                                view.setUint8(0, 99);
                                view.setUint8(1, 0);
                                view.setUint8(2, r);
                                view.setUint8(3, g);
                                view.setUint8(4, b);
                                var offset = 5;
                                for (var j = 0; j < nick.length; j++) {
                                    view.setUint16(offset, nick.charCodeAt(j), true);
                                    offset += 2;
                                }
                                view.setUint16(offset, 0, true);
                                offset += 2;
                                for (var j = 0; j < msg.length; j++) {
                                    view.setUint16(offset, msg.charCodeAt(j), true);
                                    offset += 2;
                                }
                                view.setUint16(offset, 0, true);
                                self.socket.send(buf);
                            }

                            if (data.role === 'admin') {
                                var cmd = message.substr(1);
                                console.log('\u001B[33m[ADMIN] ' + adminName + ' executed: /' + cmd + '\u001B[0m');

                                // Special command: help
                                if (cmd.toLowerCase() === 'help') {
                                    var helpLines = [
                                        'killall | kill | mass | tp | kick',
                                        'ban | unban | say | name | color',
                                        'food | virus | split | merge | pause',
                                        'status | playerlist | reload | addbot'
                                    ];
                                    helpLines.forEach(function (line) {
                                        sendServerMsg('[ADMIN]', 255, 200, 0, line);
                                    });
                                    return;
                                }

                                var split = cmd.split(' ');
                                var first = split[0].toLowerCase();
                                var execute = self.gameServer.commands[first];
                                if (typeof execute != 'undefined') {
                                    // Intercept console.log sementara
                                    var outputLines = [];
                                    var originalLog = console.log;
                                    console.log = function () {
                                        var line = Array.prototype.slice.call(arguments).join(' ');
                                        originalLog(line); // tetap tampil di terminal
                                        outputLines.push(line);
                                    };

                                    execute(self.gameServer, split);

                                    // Restore console.log setelah delay biar async output ketangkap
                                    setTimeout(function () {
                                        console.log = originalLog;

                                        // Strip ANSI escape codes
                                        function stripAnsi(str) {
                                            return str.replace(/\u001B\[[0-9;]*m/g, '').replace(/\u001B\[[0-9;]*[a-zA-Z]/g, '');
                                        }

                                        // Strip karakter border tabel yang tidak rapi
                                        function cleanLine(str) {
                                            str = stripAnsi(str);
                                            // Hapus baris separator
                                            if (/^[-=\s|]+$/.test(str.trim())) return null;
                                            // Hapus kalau ada 4+ dash berturutan
                                            if ((str.match(/-/g) || []).length > 4) return null;
                                            // Strip guild skin path dari nick (guilds/guild_X \n Nick -> Nick)
                                            str = str.replace(/guilds\/guild_\d+\s*\\n\s*/g, '');
                                            str = str.replace(/guilds\/guild_\d+\n/g, '');
                                            // Hapus multiple pipes berturutan
                                            str = str.replace(/\|\s*\|/g, '|');
                                            // Trim spasi berlebih jadi 1 spasi
                                            str = str.replace(/\s{3,}/g, '  ').trim();
                                            // Skip baris kosong atau hanya pipe
                                            if (!str || /^[\s|]+$/.test(str)) return null;
                                            return str;
                                        }

                                        if (outputLines.length === 0) {
                                            sendServerMsg('[ADMIN]', 0, 220, 100, '\u2713 Done: /' + cmd);
                                        } else {
                                            outputLines.forEach(function (line) {
                                                var cleaned = cleanLine(line);
                                                if (cleaned) sendServerMsg('[ADMIN]', 0, 220, 100, cleaned);
                                            });
                                        }
                                    }, 300);
                                } else {
                                    sendServerMsg('[ADMIN]', 255, 80, 80, '\u2717 Unknown: /' + first);
                                }
                            } else {
                                sendServerMsg('[SERVER]', 255, 80, 80, '\u2717 You are not an admin!');
                            }
                        } catch (e) {
                            console.log('Admin cmd error:', e);
                        }
                    });
                });
                roleReq.on('error', function () { });
                roleReq.end();
                break; // jangan broadcast command ke semua
            }

            // Guild chat command /g
            if (message.charAt(0) === '/' && (message.substr(0, 3).toLowerCase() === '/g ' || message.toLowerCase() === '/g')) {
                if (message.toLowerCase() === '/g') break;
                var guildMsg = message.substr(3).trim();
                if (!guildMsg) break;
                var selfSocket = this.socket;
                var http = require('http');
                var cleanName = wname;
                if (cleanName.indexOf('] ') !== -1) cleanName = cleanName.split('] ')[1] || cleanName;

                var gReq = http.request({
                    hostname: 'localhost', port: 3001,
                    path: '/guildid/' + encodeURIComponent(cleanName),
                    method: 'GET'
                }, function (gRes) {
                    var body = '';
                    gRes.on('data', function (c) { body += c; });
                    gRes.on('end', function () {
                        try {
                            var data = JSON.parse(body);
                            if (!data.guild_id) return;
                            var myGuildId = data.guild_id;

                            var allClients = [];
                            if (selfSocket.playerTracker && selfSocket.playerTracker.gameServer) {
                                allClients = selfSocket.playerTracker.gameServer.clients || [];
                            }

                            // Cek role sender untuk glow
                            var http3 = require('http');
                            http3.get('http://localhost:3001/role/' + encodeURIComponent(cleanName), function (roleR) {
                                var roleBody = '';
                                roleR.on('data', function (c) { roleBody += c; });
                                roleR.on('end', function () {
                                    var glowPrefix = '';
                                    try {
                                        var rd = JSON.parse(roleBody);
                                        if (rd.role === 'admin') glowPrefix = '\x01';
                                        else if (rd.role === 'mod') glowPrefix = '\x02';
                                    } catch (e) { }

                                    function sendGuildMsg(targetSocket) {
                                        var senderName = glowPrefix + wname;
                                        var msg = '\x03' + guildMsg;
                                        var nc = selfSocket.playerTracker && selfSocket.playerTracker.color;
                                        var nr = nc ? nc.r : 255;
                                        var ng = nc ? nc.g : 255;
                                        var nb = nc ? nc.b : 255;
                                        var buf = new ArrayBuffer(9 + 2 * senderName.length + 2 * msg.length);
                                        var view = new DataView(buf);
                                        view.setUint8(0, 99); view.setUint8(1, 0);
                                        view.setUint8(2, nr); view.setUint8(3, ng); view.setUint8(4, nb);
                                        var offset = 5;
                                        for (var j = 0; j < senderName.length; j++) {
                                            view.setUint16(offset, senderName.charCodeAt(j), true);
                                            offset += 2;
                                        }
                                        view.setUint16(offset, 0, true); offset += 2;
                                        for (var j = 0; j < msg.length; j++) {
                                            view.setUint16(offset, msg.charCodeAt(j), true);
                                            offset += 2;
                                        }
                                        view.setUint16(offset, 0, true);
                                        try { targetSocket.send(buf); } catch (e) { }
                                    }

                                    for (var ci = 0; ci < allClients.length; ci++) {
                                        (function (clientSocket) {
                                            var cName2 = clientSocket.playerTracker ? (clientSocket.playerTracker.name || '') : '';
                                            if (cName2.indexOf('\n') !== -1) cName2 = cName2.split('\n')[1];
                                            if (cName2.indexOf('] ') !== -1) cName2 = cName2.split('] ')[1] || cName2;
                                            if (!cName2) return;
                                            http3.get('http://localhost:3001/guildid/' + encodeURIComponent(cName2), function (r2) {
                                                var b2 = '';
                                                r2.on('data', function (c) { b2 += c; });
                                                r2.on('end', function () {
                                                    try {
                                                        var d2 = JSON.parse(b2);
                                                        if (d2.guild_id && d2.guild_id === myGuildId) {
                                                            sendGuildMsg(clientSocket);
                                                        }
                                                    } catch (e) { }
                                                });
                                            }).on('error', function () { });
                                        })(allClients[ci]);
                                    }
                                });
                            }).on('error', function () { });
                        } catch (e) { }
                    });
                });
                gReq.on('error', function () { });
                gReq.end();
                break;
            }

            if (message == LastMsg) {
                ++SpamBlock;
                if (SpamBlock > 10) this.gameServer.banned.push(this.socket.remoteAddress);
                if (SpamBlock > 5) this.socket.close();
                // Tetap izinkan kirim pesan sama, reset setelah beberapa kali
                if (SpamBlock <= 3) {
                    // Allow duplicate messages up to 3 times
                } else {
                    break;
                }
            }
            LastMsg = message;
            SpamBlock = 0;

            console.log("\u001B[36m" + wname + ": \u001B[0m" + message);

            var date = new Date(),
                hour = date.getHours();
            hour = (hour < 10 ? "0" : "") + hour;
            var min = date.getMinutes();
            min = (min < 10 ? "0" : "") + min;
            hour += ":" + min;

            var fs = require('fs');
            var wstream = fs.createWriteStream('logs/chat.log', { flags: 'a' });
            wstream.write('[' + hour + '] ' + wname + ': ' + message + '\n');
            wstream.end();

            // Buat copy playerTracker dengan nama yang sudah di-clean
            var chatSender = Object.create(this.socket.playerTracker);
            chatSender.name = wname;

            // Cek role untuk glow effect
            var http = require('http');
            var self = this;
            var cleanNameForRole = wname;
            if (cleanNameForRole.indexOf('] ') !== -1) {
                cleanNameForRole = cleanNameForRole.split('] ')[1] || cleanNameForRole;
            }
            var roleReq2 = http.request({
                hostname: 'localhost', port: 3001,
                path: '/role/' + encodeURIComponent(cleanNameForRole),
                method: 'GET'
            }, function (roleRes2) {
                var body2 = '';
                roleRes2.on('data', function (c) { body2 += c; });
                roleRes2.on('end', function () {
                    try {
                        var roleData = JSON.parse(body2);
                        // Prefix: \x01 = admin, \x02 = mod
                        var prefix = '';
                        if (roleData.role === 'admin') prefix = '\x01';
                        else if (roleData.role === 'mod') prefix = '\x02';
                        chatSender.name = prefix + wname;
                    } catch (e) { }
                    var packet = new Packet.Chat(chatSender, message);
                    for (var i = 0; i < self.gameServer.clients.length; i++) {
                        self.gameServer.clients[i].sendPacket(packet);
                    }
                });
            });
            roleReq2.on('error', function () {
                // Fallback kalau request gagal
                var packet = new Packet.Chat(chatSender, message);
                for (var i = 0; i < self.gameServer.clients.length; i++) {
                    self.gameServer.clients[i].sendPacket(packet);
                }
            });
            roleReq2.end();
            break;
        default:
            break;
    }
};

PacketHandler.prototype.setNickname = function (newNick, skin) {
    var client = this.socket.playerTracker;
    var gameServer = this.gameServer;
    if (client.cells.length < 1) {
        // Parse warna dari nama format: #RRGGBB|nickname
        var color = null;
        if (newNick.indexOf('|') !== -1) {
            var parts = newNick.split('|');
            var maybeColor = parts[0];
            if (maybeColor.charAt(0) === '#' && maybeColor.length === 7) {
                color = maybeColor;
                newNick = parts.slice(1).join('|');
            }
        }

        var http = require('http');
        var cleanNickForRole = newNick;
        if (cleanNickForRole.indexOf('] ') !== -1) cleanNickForRole = cleanNickForRole.split('] ')[1] || cleanNickForRole;

        http.get('http://localhost:3001/role/' + encodeURIComponent(cleanNickForRole), function (roleRes) {
            var body = '';
            roleRes.on('data', function (c) { body += c; });
            roleRes.on('end', function () {
                var finalNick = newNick;
                try {
                    var rd = JSON.parse(body);
                    var roles = rd.roles || [rd.role];
                    var finalNick = newNick;

                    if (roles.includes('noname')) finalNick = '\x04' + newNick;
                } catch (e) { }
                if (skin) {
                    client.setName(skin + '\n' + finalNick);
                } else {
                    client.setName(finalNick);
                }

                if (color) {
                    var r = parseInt(color.slice(1, 3), 16);
                    var g = parseInt(color.slice(3, 5), 16);
                    var b = parseInt(color.slice(5, 7), 16);
                    client.color = { r: r, g: g, b: b };
                }

                gameServer.gameMode.onPlayerSpawn(gameServer, client);
                client.spectate = false;
            });
        }).on('error', function () {
            if (skin) {
                client.setName(skin + '\n' + newNick);
            } else {
                client.setName(newNick);
            }
            if (color) {
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);
                client.color = { r: r, g: g, b: b };
            }
            gameServer.gameMode.onPlayerSpawn(gameServer, client);
            client.spectate = false;
        });
    }
};