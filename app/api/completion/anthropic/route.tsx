import { AnthropicStream, StreamingTextResponse } from "ai";

// IMPORTANT! Set the runtime to edge
export const runtime = "edge";

export async function POST(req: Request) {
    // Extract the `prompt` from the body of the request
    const { prompt } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/complete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            prompt: `Human: ${prompt}\n\nAssistant:`,
            model: "claude-v2",
            max_tokens_to_sample: 300,
            temperature: 0.9,
            stream: true,
        }),
    });

    // Convert the response into a friendly text-stream
    const stream = AnthropicStream(response);

    // Respond with the stream
    return new StreamingTextResponse(stream);
}
