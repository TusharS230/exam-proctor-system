document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('jwt_token');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    let userProfile = null;
    try {
        userProfile = await ApiClient.get('/users/me');
        sessionStorage.setItem('role', userProfile.role);
        sessionStorage.setItem('email', userProfile.email);
    } catch (e) {
        console.error('Failed to fetch user profile:', e);
        return;
    }

    const role = userProfile.role;
    const email = userProfile.email;
    const userId = userProfile.id;
    const orgId = userProfile.organization ? userProfile.organization.id : null;

    const inboxView = document.getElementById('inboxView');
    const threadView = document.getElementById('threadView');
    const inboxTableBody = document.getElementById('inboxTableBody');
    const composeBtn = document.getElementById('composeBtn');
    const composeModal = document.getElementById('composeModal');
    const composeForm = document.getElementById('composeForm');
    const cancelComposeBtn = document.getElementById('cancelComposeBtn');
    const composeTo = document.getElementById('composeTo');

    const threadSubject = document.getElementById('threadSubject');
    const threadMessagesContainer = document.getElementById('threadMessages');
    const backToInboxBtn = document.getElementById('backToInboxBtn');
    const sendReplyBtn = document.getElementById('sendReplyBtn');
    const replyContent = document.getElementById('replyContent');

    let currentThreadId = null;

    // Set up Compose Box "To" field based on Role
    if (composeTo) {
        if (role === 'STUDENT') {
            composeTo.value = 'Organization Admin';
        } else if (role === 'ORG_ADMIN') {
            composeTo.value = 'System Admin (Owner)';
        }
    }


    await loadInbox();

    // Listen for global new message events
    document.addEventListener('newMessageReceived', (e) => {
        const newMsg = e.detail;

        // If currently viewing this exact thread, append the message
        if (threadView.style.display === 'block' && currentThreadId === newMsg.threadId) {
            const isMe = false;
            const msgDiv = document.createElement('div');
            msgDiv.className = isMe ? 'msg-bubble mine' : 'msg-bubble';

            const senderName = isMe ? 'You' : newMsg.senderEmail;
            const timeString = new Date(newMsg.createdAt).toLocaleString();

            msgDiv.innerHTML = `
                <div class="small mb-1">
                    <strong>${escapeHtml(senderName)}</strong> • ${timeString}
                </div>
                <div>
                    ${escapeHtml(newMsg.content).replace(/\n/g, '<br>')}
                </div>
            `;
            threadMessagesContainer.appendChild(msgDiv);
            threadMessagesContainer.scrollTop = threadMessagesContainer.scrollHeight;

            // Automatically mark as read if we are looking at the thread
            ApiClient.put(`/messages/${newMsg.id}/read`).catch(err => console.error(err));
        }

        // Refresh the inbox table silently in the background
        if (inboxView.style.display === 'block') {
            loadInbox();
        }
    });

    async function loadInbox() {
        inboxView.style.display = 'block';
        threadView.style.display = 'none';

        try {
            // received and sent messages together, so conversations you started also show up
            const [received, sent] = await Promise.all([
                ApiClient.get('/messages/inbox'),
                ApiClient.get('/messages/sent')
            ]);

            const byId = {};
            [...(received || []), ...(sent || [])].forEach(msg => { byId[msg.id] = msg; });
            const messages = Object.values(byId);

            inboxTableBody.innerHTML = '';
            if (messages.length === 0) {
                inboxTableBody.innerHTML = '<tr><td class="text-center" colspan="4">No messages yet.</td></tr>';
                return;
            }

            // one row per conversation, showing its newest message
            const threadMap = {};
            messages.forEach(msg => {
                if (!threadMap[msg.threadId]) threadMap[msg.threadId] = [];
                threadMap[msg.threadId].push(msg);
            });

            const threads = Object.values(threadMap).map(thread => {
                thread.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                return thread;
            });
            // newest conversations first
            threads.sort((a, b) => new Date(b[0].createdAt) - new Date(a[0].createdAt));

            threads.forEach(thread => {
                const latestMsg = thread[0];
                const sentByMe = latestMsg.senderId === userId;

                const tr = document.createElement('tr');
                // bold = someone else wrote to you and you have not opened it yet
                if (!sentByMe && !latestMsg.read) tr.classList.add('bold');

                const fromOrTo = sentByMe
                    ? `To: ${escapeHtml(describeRecipient(latestMsg))}`
                    : `From: ${escapeHtml(latestMsg.organizationName ? latestMsg.senderEmail + ' (' + latestMsg.organizationName + ')' : latestMsg.senderEmail)}`;

                tr.innerHTML = `
                    <td>${escapeHtml(latestMsg.subject || 'No Subject')}</td>
                    <td>${fromOrTo}</td>
                    <td>${new Date(latestMsg.createdAt).toLocaleString()}</td>
                    <td><button class="btn-primary view-btn small" data-thread="${latestMsg.threadId}">View Thread</button></td>
                `;
                inboxTableBody.appendChild(tr);
            });

            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    openThread(e.target.getAttribute('data-thread'));
                });
            });

        } catch (error) {
            console.error('Error loading inbox:', error);
            inboxTableBody.innerHTML = '<tr><td class="text-center text-red" colspan="4">Failed to load messages.</td></tr>';
        }
    }

    // who a message I sent went to, in words
    function describeRecipient(msg) {
        if (msg.recipientEmail) return msg.recipientEmail;
        if (role === 'STUDENT') return 'Organization admin';
        if (role === 'ORG_ADMIN') return 'System admin';
        return msg.organizationName ? msg.organizationName + ' admin' : 'Organization admin';
    }

    async function openThread(threadId) {
        currentThreadId = threadId;
        inboxView.style.display = 'none';
        threadView.style.display = 'block';
        threadMessagesContainer.innerHTML = '<div class="text-center">Loading thread...</div>';

        try {
            const messages = await ApiClient.get(`/messages/thread/${threadId}`);
            if (messages.length > 0) {
                threadSubject.textContent = messages[0].subject || 'No Subject';
            }

            threadMessagesContainer.innerHTML = '';

            messages.forEach(msg => {
                const isMe = msg.senderEmail === email;

                // mark as read if it's not mine and unread
                if (!isMe && !msg.read) {
                    ApiClient.put(`/messages/${msg.id}/read`).catch(e => console.error(e));
                }

                const msgDiv = document.createElement('div');
                msgDiv.className = isMe ? 'msg-bubble mine' : 'msg-bubble';

                msgDiv.innerHTML = `
                    <div class="small mb-1">
                        <b>${isMe ? 'You' : escapeHtml(msg.organizationName ? msg.senderEmail + ' (' + msg.organizationName + ')' : msg.senderEmail)}</b> - ${new Date(msg.createdAt).toLocaleString()}
                    </div>
                    <div class="pre-wrap">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
                `;
                threadMessagesContainer.appendChild(msgDiv);
            });

            // scroll to bottom
            threadMessagesContainer.scrollTop = threadMessagesContainer.scrollHeight;

        } catch (error) {
            console.error('Error loading thread:', error);
            threadMessagesContainer.innerHTML = '<div class="text-center text-red">Failed to load thread.</div>';
        }
    }

    backToInboxBtn.addEventListener('click', () => {
        currentThreadId = null;
        loadInbox();
    });

    sendReplyBtn.addEventListener('click', async () => {
        const content = replyContent.value.trim();
        if (!content) return;

        try {
            sendReplyBtn.disabled = true;
            sendReplyBtn.textContent = 'Sending...';

            await ApiClient.post('/messages/send', {
                threadId: currentThreadId,
                content: content
            });

            replyContent.value = '';
            await openThread(currentThreadId); // Reload thread

        } catch (error) {
            // ApiClient already showed the error message
            console.error('Error sending reply:', error);
        } finally {
            sendReplyBtn.disabled = false;
            sendReplyBtn.textContent = 'Send Reply';
        }
    });

    if (composeBtn) {
        composeBtn.addEventListener('click', async () => {
            composeModal.style.display = 'flex';
            if (role === 'SUPER_ADMIN') {
                const orgSelect = document.getElementById('composeToOrg');
                if (orgSelect && orgSelect.options.length <= 1) {
                    try {
                        const orgs = await ApiClient.get('/organizations');
                        orgSelect.innerHTML = '<option value="" disabled selected>Select an Organization...</option>';
                        orgs.forEach(org => {
                            const opt = document.createElement('option');
                            opt.value = org.id;
                            opt.textContent = org.name;
                            orgSelect.appendChild(opt);
                        });
                    } catch (error) {
                        console.error('Failed to load orgs for messaging', error);
                        orgSelect.innerHTML = '<option value="" disabled>Failed to load organizations</option>';
                    }
                }
            }
        });
    }

    cancelComposeBtn.addEventListener('click', () => {
        composeModal.style.display = 'none';
        composeForm.reset();
    });

    composeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const subject = document.getElementById('composeSubject').value.trim();
        const content = document.getElementById('composeContent').value.trim();

        if (!subject || !content) return;

        let orgId = null;
        if (role === 'SUPER_ADMIN') {
            const orgSelect = document.getElementById('composeToOrg');
            orgId = orgSelect ? orgSelect.value : null;
            if (!orgId) {
                Toast.error('Please select an organization.');
                return;
            }
        }

        const submitBtn = composeForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            await ApiClient.post('/messages/send', {
                subject: subject,
                content: content,
                threadId: null,
                organizationId: orgId
            });

            composeModal.style.display = 'none';
            composeForm.reset();
            Toast.success('Message sent.');
            await loadInbox();

        } catch (error) {
            // ApiClient already showed the error message
            console.error('Error composing message:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    });
});
