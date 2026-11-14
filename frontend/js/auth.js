"use strict";

// Magic-link sign-in. Load after supabase-client.js and before app.js.
(() => {
    const client = window.db || (typeof db !== "undefined" ? db : null);
    const host = document.querySelector(".page-heading") || document.querySelector("main");
    if (!host) return;
    const panel = document.createElement("section");
    panel.setAttribute("aria-label", "Account sign-in");
    panel.style.cssText = "padding:18px;margin:20px 0;border:1px solid #e1e7df;border-radius:12px;background:white";
    panel.innerHTML = `
    <p data-account style="margin:0 0 12px">Sign in to report occupancy. Browsing does not require an account.</p>
    <form data-form style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">
      <label style="display:grid;gap:6px">Email address
        <input data-email type="email" autocomplete="email" required placeholder="you@example.com">
      </label>
      <button class="primary-button" type="submit">Email me a sign-in link</button>
    </form>
    <button data-signout class="primary-button" type="button" hidden>Sign out</button>
    <p data-message role="status" aria-live="polite" style="margin-bottom:0;font-size:12px"></p>
  `;
    host.insertAdjacentElement("afterend", panel);
    const find = selector => panel.querySelector(selector);
    const form = find("[data-form]");
    const emailInput = find("[data-email]");
    const account = find("[data-account]");
    const message = find("[data-message]");
    const signout = find("[data-signout]");
    let busy = false;
    let cooldownUntil = 0;
    function setBusy(value) {
        busy = value;
        panel.querySelectorAll("button").forEach(button => button.disabled = value);
        emailInput.disabled = value;
    }
    function showSession(session) {
        const signedIn = Boolean(session?.user);
        account.textContent = signedIn
            ? `Signed in as ${session.user.email || "a campus visitor"}. You can now submit occupancy reports.`
            : "Sign in to report occupancy. Browsing does not require an account.";
        form.hidden = signedIn;
        form.style.display = signedIn ? "none" : "flex";
        signout.hidden = !signedIn;
    }
    if (!client) {
        message.textContent = "Supabase is unavailable. Load supabase-client.js before auth.js.";
        setBusy(true);
        return;
    }
    // Display an unsuccessful return from an expired or invalid email link.
    const callback = new URLSearchParams(window.location.hash.slice(1));
    if (callback.has("error_description")) {
        message.textContent = callback.get("error_description");
    }
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        if (Date.now() < cooldownUntil) {
            message.textContent = `Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)} seconds before requesting another link.`;
            return;
        }
        setBusy(true);
        message.textContent = "Requesting sign-in link…";
        try {
            const { error } = await client.auth.signInWithOtp({
                email: emailInput.value.trim(),
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) throw error;
            cooldownUntil = Date.now() + 60000;
            message.textContent = "Check your email and spam folder. Open the sign-in link in this browser to return to the app.";
        } catch (error) {
            message.textContent = `Could not send link: ${error.message || "Please try again."}`;
        } finally { setBusy(false); }
    });
    signout.addEventListener("click", async () => {
        if (busy) return;
        setBusy(true);
        try {
            const { error } = await client.auth.signOut();
            if (error) throw error;
            showSession(null);
            message.textContent = "Signed out.";
        } catch (error) {
            message.textContent = `Could not sign out: ${error.message || "Please try again."}`;
        } finally { setBusy(false); }
    });
    client.auth.onAuthStateChange((event, session) => {
        showSession(session);
        if (event === "SIGNED_IN") message.textContent = "Signed in. Choose View space to submit a headcount.";
        if (event === "SIGNED_OUT") message.textContent = "Signed out.";
    });
    client.auth.getSession().then(({ data, error }) => {
        if (error) message.textContent = error.message;
        else showSession(data.session);
    }).catch(error => { message.textContent = error.message; });
})();
