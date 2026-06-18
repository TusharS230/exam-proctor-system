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
            msgDiv.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
            msgDiv.style.background = isMe ? 'var(--primary-color)' : 'var(--surface-color)';
            msgDiv.style.color = isMe ? '#fff' : 'var(--text-primary)';
            msgDiv.style.padding = '1rem';
            msgDiv.style.borderRadius = '8px';
            msgDiv.style.maxWidth = '70%';
            msgDiv.style.border = isMe ? 'none' : '1px solid var(--border-color)';
            
            const senderName = isMe ? 'You' : newMsg.senderEmail;
            const timeString = new Date(newMsg.createdAt).toLocaleString();
            
            msgDiv.innerHTML = `
                <div style="font-size:0.8rem; margin-bottom:0.4rem; opacity:0.8;">
                    <strong>${senderName}</strong> • ${timeString}
                </div>
                <div style="line-height:1.4;">
                    ${newMsg.content.replace(/\n/g, '<br>')}
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
            const messages = await ApiClient.get('/messages/inbox');
            
            inboxTableBody.innerHTML = '';
            if (!messages || messages.length === 0) {
                inboxTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No messages in your inbox.</td></tr>';
                return;
            }

            // Group by thread ID to just show the latest message per thread
            const threadMap = {};
            messages.forEach(msg => {
                if (!threadMap[msg.threadId]) {
                    threadMap[msg.threadId] = [];
                }
                threadMap[msg.threadId].push(msg);
            });

            Object.values(threadMap).forEach(thread => {
                // sort by date desc
                thread.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                const latestMsg = thread[0];
                
                const tr = document.createElement('tr');
                if (!latestMsg.read) tr.style.fontWeight = 'bold';
                
                const senderText = latestMsg.organizationName ? `${latestMsg.senderEmail} (${latestMsg.organizationName})` : latestMsg.senderEmail;
                
                tr.innerHTML = `
                    <td>${latestMsg.subject || 'No Subject'}</td>
                    <td>From: ${senderText}</td>
                    <td>${new Date(latestMsg.createdAt).toLocaleString()}</td>
                    <td><button class="btn-primary view-btn" data-thread="${latestMsg.threadId}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">View Thread</button></td>
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
            inboxTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Failed to load messages.</td></tr>';
        }
    }

    async function openThread(threadId) {
        currentThreadId = threadId;
        inboxView.style.display = 'none';
        threadView.style.display = 'block';
        threadMessagesContainer.innerHTML = '<div style="text-align:center;">Loading thread...</div>';
        
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
                msgDiv.style.padding = '1rem';
                msgDiv.style.borderRadius = '8px';
                msgDiv.style.maxWidth = '80%';
                
                if (isMe) {
                    msgDiv.style.background = 'var(--primary-color)';
                    msgDiv.style.color = 'white';
                    msgDiv.style.alignSelf = 'flex-end';
                } else {
                    msgDiv.style.background = 'var(--surface-color)';
                    msgDiv.style.border = '1px solid var(--border-color)';
                    msgDiv.style.alignSelf = 'flex-start';
                }

                msgDiv.innerHTML = `
                    <div style="font-size: 0.8rem; margin-bottom: 0.5rem; opacity: 0.8;">
                        <b>${isMe ? 'You' : (msg.organizationName ? msg.senderEmail + ' (' + msg.organizationName + ')' : msg.senderEmail)}</b> - ${new Date(msg.createdAt).toLocaleString()}
                    </div>
                    <div style="white-space: pre-wrap;">${msg.content}</div>
                `;
                threadMessagesContainer.appendChild(msgDiv);
            });
            
            // scroll to bottom
            threadMessagesContainer.scrollTop = threadMessagesContainer.scrollHeight;

        } catch (error) {
            console.error('Error loading thread:', error);
            threadMessagesContainer.innerHTML = '<div style="text-align:center; color:red;">Failed to load thread.</div>';
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
            console.error('Error sending reply:', error);
            alert('Failed to send reply. Please try again.');
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
                alert('Please select an organization.');
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
            alert('Message sent successfully!');
            await loadInbox();
            
        } catch (error) {
            console.error('Error composing message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    });
});
