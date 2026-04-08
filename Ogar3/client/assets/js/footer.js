function loadFooter(containerId) {
    const loggedUser = localStorage.getItem('loggedUser');
    const footerEl = document.getElementById(containerId);
    if (!footerEl) return;

    const dropId = 'communityDropdown_' + containerId;
    const btnId = 'communityBtn_' + containerId;

    footerEl.innerHTML = `
        <span class="text-muted">
            <a href="index.html">Home</a> | 
            <a href="${loggedUser ? 'account.html' : 'login.html'}">${loggedUser ? 'Account' : 'Login'}</a> | 
            <span style="position:relative; display:inline-block;">
                <a href="#" id="${btnId}" onclick="toggleCommunity(event, '${dropId}', '${btnId}')">Community</a>
                <div id="${dropId}" style="display:none; position:absolute; bottom:24px; left:50%; transform:translateX(-50%); background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15); min-width:130px; z-index:999; text-align:center;">
                    <a href="friends.html" style="display:block; padding:8px 16px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">Friends</a>
                    <a href="notifications.html" style="display:block; padding:8px 16px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">Notifications</a>
                    <a href="highscore.html" style="display:block; padding:8px 16px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">Highscore</a>
                    <a href="guilds.html" style="display:block; padding:8px 16px; color:#333; text-decoration:none;">Guilds</a>
                </div>
            </span> | 
            <a href="#">Contact</a>
        </span>
    `;
}

function toggleCommunity(e, dropId, btnId) {
    e.preventDefault();
    var d = document.getElementById(dropId);
    d.style.display = d.style.display === 'none' ? 'block' : 'none';
    setTimeout(function() {
        document.addEventListener('click', function handler(ev) {
            if (!ev.target.closest('#' + dropId) && ev.target.id !== btnId) {
                d.style.display = 'none';
            }
            document.removeEventListener('click', handler);
        });
    }, 0);
}