const {
    proto,
    getContentType,
    jidNormalizedUser
} = require('@whiskeysockets/baileys')

const heart = (Cypher, m) => {
    if (!m) return m
    let M = proto.WebMessageInfo
    if (m.key) {
        m.id = m.key.id
        // Only flag as a bot-generated echo when it's a message WE actually sent
        // ourselves through Cypher.sendMessage (tracked in global.sentMsgIds by
        // botify.js). Guessing this from the message-ID prefix/length is NOT
        // reliable — WhatsApp mobile now generates IDs in the same format the
        // library uses, so that heuristic was dropping real messages typed by the
        // owner (including in groups).
        m.isBaileys = !!m.key.fromMe && !!(global.sentMsgIds && global.sentMsgIds.has(m.id));
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = jidNormalizedUser(m.fromMe && Cypher.user.id || m.participant || m.key.participant || m.chat || '')
        if (m.isGroup) m.participant = jidNormalizedUser(m.key.participant) || ''
    }
    if (m.message) {
        m.mtype = getContentType(m.message)

        // ── Unwrap outer message layers ───────────────────────────────────────────
        // WhatsApp wraps messages in these container types when certain features
        // are active in a chat:
        //   ephemeralMessage            → disappearing / timed messages (common in groups)
        //   viewOnceMessageV2           → second-generation view-once media
        //   documentWithCaptionMessage  → document + caption combo
        // Without unwrapping, every field in the body extraction below resolves to
        // undefined, body becomes '', isCmd = false, and ALL commands are silently
        // dropped — giving the appearance that the bot "doesn't respond in groups"
        // when disappearing messages are enabled.
        const WRAPPER_TYPES = ['ephemeralMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage'];
        let innerMessage = m.message;
        if (WRAPPER_TYPES.includes(m.mtype) && m.message[m.mtype]?.message) {
            innerMessage = m.message[m.mtype].message;
            m.mtype = getContentType(innerMessage) || m.mtype;
        }

        m.msg = (m.mtype == 'viewOnceMessage'
            ? innerMessage[m.mtype]?.message?.[getContentType(innerMessage[m.mtype]?.message)]
            : innerMessage[m.mtype])

        m.body =
          m.message?.protocolMessage?.editedMessage?.conversation ||
          m.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
          m.message?.protocolMessage?.editedMessage?.imageMessage?.caption ||
          m.message?.protocolMessage?.editedMessage?.videoMessage?.caption ||
          innerMessage?.conversation ||
          innerMessage?.imageMessage?.caption ||
          innerMessage?.videoMessage?.caption ||
          innerMessage?.extendedTextMessage?.text ||
          m.message?.buttonsResponseMessage?.selectedButtonId ||
          m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          m.message?.templateButtonReplyMessage?.selectedId ||
          m.message?.pollCreationMessageV3?.name ||
          innerMessage?.documentMessage?.caption ||
          m.text || "";

       m.budy =
          typeof m.body === "string" && m.body.length > 0
            ? m.body
            : typeof m.text === "string"
              ? m.text
              : "";

let quoted = m.quoted = (m.msg && m.msg.contextInfo) ? m.msg.contextInfo.quotedMessage : null;
m.mentionedJid = (m.msg && m.msg.contextInfo) ? m.msg.contextInfo.mentionedJid || [] : [];

if (m.quoted) {
    try {
        let type = getContentType(quoted);
        if (m.quoted[type]) {
            m.quoted = m.quoted[type];
            if (['productMessage'].includes(type)) {
                type = getContentType(m.quoted);
                m.quoted = m.quoted[type];
            }
            if (typeof m.quoted === 'string') {
                m.quoted = { text: m.quoted };
            }
            m.quoted.mtype = type;

            if (m.msg && m.msg.contextInfo) {
                m.quoted.id = m.msg.contextInfo.stanzaId;
                m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
                m.quoted.sender = jidNormalizedUser(m.msg.contextInfo.participant);
                m.quoted.fromMe = m.quoted.sender === (Cypher.user && Cypher.user.id);
                m.quoted.mentionedJid = m.msg.contextInfo.mentionedJid || [];
            } else {
                m.quoted.id = null;
                m.quoted.chat = m.chat;
                m.quoted.sender = null;
                m.quoted.fromMe = false;
                m.quoted.mentionedJid = [];
            }

            m.quoted.isBaileys = !!(m.quoted.id && m.quoted.fromMe && global.sentMsgIds && global.sentMsgIds.has(m.quoted.id));
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';

            let vM = m.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id,
                },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {}),
            });

            m.quoted.delete = () => Cypher.sendMessage(m.quoted.chat, {
                delete: vM.key,
            });

            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => Cypher.copyNForward(jid, vM, forceForward, options);

            m.quoted.download = () => Cypher.downloadMediaMessage(m.quoted);
        }
    } catch (error) {
        console.error('Error handling quoted message:', error);
    }
}
    }
    if (m.msg && m.msg.url) {
    m.download = () => Cypher.downloadMediaMessage(m.msg);
}

m.text = m.msg ? (m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || '') : '';
    /**
     * Reply to this message
     * @param {String|Object} text
     * @param {String|false} chatId
     * @param {Object} options
     */
    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? Cypher.sendFile(chatId, text, 'file', '', m, {
        ...options
    }) : Cypher.sendText(chatId, text, m, {
        ...options
    })
    /**
     * Copy this message
     */
    m.copy = () => heart(Cypher, M.fromObject(M.toObject(m)))

    /**
     *
     * @param {*} jid
     * @param {*} forceForward
     * @param {*} options
     * @returns
     */
    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => Cypher.copyNForward(jid, m, forceForward, options)

    return m
}

module.exports = { heart }
