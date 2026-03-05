import { NextResponse } from "next/server";
import { getProviderNodeById, getProviderConnections } from "@/models";

// GET /api/provider-nodes/[id]/models — Fetch available models from a custom provider
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const node = await getProviderNodeById(id);

        if (!node) {
            return NextResponse.json({ error: "Provider node not found" }, { status: 404 });
        }

        if (node.type !== "openai-compatible") {
            return NextResponse.json({ error: "Only OpenAI-compatible providers support model listing" }, { status: 400 });
        }

        // Find the active connection to get the API key
        const connections = await getProviderConnections({ provider: id, isActive: true });
        const connection = connections[0];
        const apiKey = connection?.apiKey || "sk-placeholder";

        const baseUrl = node.baseUrl?.replace(/\/$/, "");
        const modelsUrl = `${baseUrl}/models`;

        const res = await fetch(modelsUrl, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Provider returned ${res.status}`, models: [] }, { status: 200 });
        }

        const data = await res.json();
        const models = (data.data || data.models || [])
            .map((m) => ({ id: m.id || m.model || m.name, name: m.id || m.model || m.name }))
            .filter((m) => m.id);

        return NextResponse.json({ models, prefix: node.prefix, name: node.name });
    } catch (error) {
        console.log("Error fetching provider models:", error);
        return NextResponse.json({ error: error.message, models: [] }, { status: 200 });
    }
}
