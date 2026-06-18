document.addEventListener('DOMContentLoaded', () => {
    const changePasswordForm = document.getElementById('changePasswordForm');
    
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                Toast.error("New passwords do not match");
                return;
            }
            
            if (newPassword.length < 6) {
                Toast.error("New password must be at least 6 characters long");
                return;
            }

            const submitBtn = document.getElementById('savePasswordBtn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Updating...';
            submitBtn.disabled = true;
            
            try {
                await ApiClient.put('/users/me/password', {
                    currentPassword: currentPassword,
                    newPassword: newPassword
                });
                
                Toast.success("Password updated successfully");
                changePasswordForm.reset();
            } catch (error) {
                // ApiClient handles showing the error toast
                console.error("Failed to update password:", error);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});
