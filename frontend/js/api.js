const API_BASE_URL = "https://alpha-bunker-backend-production.up.railway.app";

function getSessionUser() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        return {
            user_id: tgUser.id,
            name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || tgUser.username || "Agente Búnker",
            username: tgUser.username || null,
            is_telegram: true,
            init_data: window.Telegram.WebApp.initData
        };
    }
    
    let localId = localStorage.getItem("alpha_user_id");
    if (!localId) {
        localId = "99" + Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem("alpha_user_id", localId);
        localStorage.setItem("alpha_user_name", "Cyber Operative");
    }
    
    return {
        user_id: parseInt(localId),
        name: localStorage.getItem("alpha_user_name") || "Cyber Operative",
        username: null,
        is_telegram: false,
        init_data: null
    };
}

async function syncUserSession() {
    const user = getSessionUser();
    try {
        const res = await fetch(`${API_BASE_URL}/users/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.user_id,
                name: user.name,
                bio: "Operativo activo en Alpha Vault",
                init_data: user.init_data,
                is_telegram: user.is_telegram
            })
        });
        return await res.json();
    } catch (err) {
        return null;
    }
}

async function fetchUserProfile(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/users/profile/${userId}`);
        if (!res.ok) throw new Error("No se pudo cargar el perfil");
        return await res.json();
    } catch (err) {
        return null;
    }
}

async function fetchWalletBalance(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/balance/${userId}`);
        if (!res.ok) throw new Error("Error al consultar balance");
        const data = await res.json();
        return {
            user_id: data.user_id,
            alpha_balance: data.balance_alfa_coins ?? data.alpha_balance ?? 0,
            total_earned: data.total_earned ?? 0,
            total_spent: data.total_spent ?? 0
        };
    } catch (err) {
        return { user_id: String(userId), alpha_balance: 0, total_earned: 0, total_spent: 0 };
    }
}

async function sendAlphaTip(senderId, creatorId, amount, postId = null) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/send-tip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender_id: parseInt(senderId),
                creator_id: parseInt(creatorId),
                amount: parseInt(amount),
                post_id: postId ? parseInt(postId) : null
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error en la transacción");
        return data;
    } catch (err) {
        throw err;
    }
}

async function depositAlphaCoins(userId, amount) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: parseInt(userId),
                amount: parseInt(amount)
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al recargar fondos");
        return data;
    } catch (err) {
        throw err;
    }
}

async function fetchGlobalFeed(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/posts/feed/${userId || 0}`);
        if (!res.ok) throw new Error("Error al obtener posts");
        const data = await res.json();
        return data.posts || [];
    } catch (err) {
        return [];
    }
}

async function buyStarsInvoice(userId, packageSlug) {
    try {
        const res = await fetch(`${API_BASE_URL}/payments/create-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: parseInt(userId),
                package_slug: packageSlug
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al generar factura");
        
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openInvoice) {
            window.Telegram.WebApp.openInvoice(data.invoice_link, (status) => {});
        } else {
            window.open(data.invoice_link, "_blank");
        }
        return data;
    } catch (err) {
        throw err;
    }
}