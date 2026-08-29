// Configuración base de la API (Apunta a tu backend en Railway)
const API_BASE_URL = "https://alpha-bunker-backend-production.up.railway.app";

// 1. Obtener datos de sesión (Soporta Telegram WebApp y APK Standalone)
function getSessionUser() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user) {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        return {
            user_id: tgUser.id,
            name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || tgUser.username || "Agente Búnker",
            username: tgUser.username || null,
            is_telegram: true
        };
    }
    
    // Fallback para APK Android Standalone
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
        is_telegram: false
    };
}

// 2. Sincronizar usuario al entrar a la app
async function syncUserSession() {
    const user = getSessionUser();
    try {
        const res = await fetch(`${API_BASE_URL}/users/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.user_id,
                name: user.name,
                bio: "Operativo activo en Alpha Vault"
            })
        });
        return await res.json();
    } catch (err) {
        console.error("[API SYNC ERROR]:", err);
        return null;
    }
}

// 3. Consultar perfil, rango e insignia
async function fetchUserProfile(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/users/profile/${userId}`);
        if (!res.ok) throw new Error("No se pudo cargar el perfil");
        return await res.json();
    } catch (err) {
        console.error("[API PROFILE ERROR]:", err);
        return null;
    }
}

// 4. Consultar balance de billetera $ALPHA
async function fetchWalletBalance(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/balance/${userId}`);
        if (!res.ok) throw new Error("Error al consultar balance");
        return await res.json();
    } catch (err) {
        console.error("[API WALLET ERROR]:", err);
        return { alpha_balance: 0, total_earned: 0, total_spent: 0 };
    }
}

// 5. Enviar propina en tokens $ALPHA
async function sendAlphaTip(senderId, receiverId, amount, postId = null) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/send-tip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender_id: senderId,
                receiver_id: receiverId,
                amount: parseInt(amount),
                post_id: postId
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error en la transacción");
        return data;
    } catch (err) {
        throw err;
    }
}

// 6. Cargar muro de publicaciones con estado de bloqueo PPV
async function fetchGlobalFeed(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/posts/get-posts?user_id=${userId}`);
        if (!res.ok) throw new Error("Error al obtener posts");
        const data = await res.json();
        return data.posts || [];
    } catch (err) {
        console.error("[API FEED ERROR]:", err);
        return [];
    }
}

// 7. Desbloquear post PPV con $ALPHA
async function unlockPpvPost(userId, postId) {
    try {
        const res = await fetch(`${API_BASE_URL}/wallet/unlock-post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                post_id: postId
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al desbloquear contenido");
        return data;
    } catch (err) {
        throw err;
    }
}

// 8. Crear factura oficial de Telegram Stars
async function buyStarsInvoice(userId, tierName, amountStars) {
    try {
        const res = await fetch(`${API_BASE_URL}/payments/create-invoice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                tier_name: tierName,
                amount_stars: amountStars
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al generar factura");
        
        // Si está en Telegram, abre el checkout nativo
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openInvoice) {
            window.Telegram.WebApp.openInvoice(data.invoice_link, (status) => {
                console.log("[STARS INVOICE STATUS]:", status);
            });
        } else {
            // En APK Standalone o navegador abre el link de Telegram
            window.open(data.invoice_link, "_blank");
        }
        return data;
    } catch (err) {
        throw err;
    }
}