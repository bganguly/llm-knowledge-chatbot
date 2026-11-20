import UI from "../ui/index.html";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(UI, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    if (url.pathname === "/query" && request.method === "POST") {
      const apiUrl = env.API_URL;
      if (!apiUrl) {
        return new Response(JSON.stringify({ detail: "API_URL not configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      const body = await request.text();
      try {
        const upstream = await fetch(`${apiUrl}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await upstream.text();
        return new Response(data, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ detail: "Backend unreachable — still waking up, please retry" }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    if (url.pathname === "/health") {
      const apiUrl = env.API_URL;
      if (!apiUrl) return new Response(JSON.stringify({ worker: "ok", api: "not configured" }), {
        headers: { "Content-Type": "application/json" },
      });
      try {
        const upstream = await fetch(`${apiUrl}/health`);
        const data = await upstream.json();
        return new Response(JSON.stringify({ worker: "ok", api: data }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ worker: "ok", api: "unreachable" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
