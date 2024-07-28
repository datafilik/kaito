// import OpenAI from "openai";
// import { OpenAIStream, StreamingTextResponse } from "ai";

import { openai } from '@ai-sdk/openai';
import { convertToCoreMessages, streamText } from 'ai';


// Create an OpenAI API client (that's edge friendly!)
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// IMPORTANT! Set the runtime to edge
// export const runtime = "edge";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-3.5-turbo'),
    messages: convertToCoreMessages(messages),
  });

  return result.toAIStreamResponse();


  // // Ask OpenAI for a streaming chat completion given the prompt
  // const response = await openai.chat.completions.create({
  //   model: "gpt-3.5-turbo",
  //   stream: true,
  //   messages,
  // });
  
  // // Convert the response into a friendly text-stream
  // const stream = OpenAIStream(response);
  // // Respond with the stream
  // return new StreamingTextResponse(stream);
}
