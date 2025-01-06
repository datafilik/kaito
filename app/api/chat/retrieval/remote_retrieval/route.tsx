import { NextRequest, NextResponse } from "next/server";
import {Message as VercelChatMessage, streamText, convertToCoreMessages, CoreTool} from "ai";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  	BytesOutputParser,
  	StringOutputParser,
} from "@langchain/core/output_parsers";

import { StreamingTextResponse } from "@/components/StreamingTextResponse";

interface StreamTextResult<T> {
	data: ReadableStream;
	response: Response;
	toDataStreamResponse: (headers?: Record<string, string>) => Response;
}

export const runtime = "edge";

const combineDocumentsFn = (docs: Document[]) => {
  	const serializedDocs = docs.map((doc) => doc.pageContent);
  	return serializedDocs.join("\n\n");
};

const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
	const formattedDialogueTurns = chatHistory.map((message) => {
		if (message.role === "user") {
			return `Human: ${message.content}`;
		} else if (message.role === "assistant") {
			return `Assistant: ${message.content}`;
		} else {
			return `${message.role}: ${message.content}`;
		}
	});
	return formattedDialogueTurns.join("\n");
};

function createStreamTextResult(
	stream: AsyncIterable<Uint8Array>, headers?: Record<string, string>
): StreamTextResult<Record<string, CoreTool<any, any>>> {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	const transformStream = new TransformStream({
		transform(chunk, controller) {
			try {
				const text = decoder.decode(chunk);
				const lines = text.split('\n').filter(line => line.trim());
				
				for (const line of lines) {
					if (line.includes('[DONE]')) {
						return;
					}
					// Ensure proper SSE format with data prefix and double newline
					controller.enqueue(encoder.encode(`data: ${line}\n\n`));
				}
			} catch (e) {
				console.error('Error transforming chunk:', e);
				controller.error(e);
			}
		}
	});

	const readable = new ReadableStream({
		async start(controller) {
			try {
				for await (const chunk of stream) {
				controller.enqueue(chunk);
				}
				controller.close();
			} catch (e) {
				controller.error(e);
			}
		}
	});

	const processedStream = readable.pipeThrough(transformStream);

	const response = new Response(processedStream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
		}
	});

	const streamTextResult = {
		data: processedStream,
		response,
		toDataStreamResponse: (additionalHeaders?: Record<string, string>) => {
			return new Response(processedStream, {
				headers: {
					...response.headers,
					...additionalHeaders
				}
			});
		}
	};


	return streamTextResult;
}

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  	CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You are a very knowlegable research assistant, and must answer all questions from first principles and in simple terms.

Answer the question based only on the following context and chat history:
<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}`;

const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

/**
 * This handler initializes and calls a retrieval chain. It composes the chain using
 * LangChain Expression Language. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#conversational-retrieval-chain
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const messages = body.messages ?? [];
		const previousMessages = messages.slice(0, -1);
		const currentMessageContent = messages[messages.length - 1].content;

		const model = new ChatOpenAI({
			modelName: "gpt-4o-mini",
			temperature: 0.2,
		});

		const pinecone = new Pinecone({
			apiKey: process.env.PINECONE_API_KEY!,
		});

		const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

		const vectorstore = await PineconeStore.fromExistingIndex(
			new OpenAIEmbeddings(),
			{ pineconeIndex }
		);

		
		/**
		 * We use LangChain Expression Language to compose two chains.
		 * To learn more, see the guide here:
		 *
		 * https://js.langchain.com/docs/guides/expression_language/cookbook
		 *
		 * You can also use the "createRetrievalChain" method with a
		 * "historyAwareRetriever" to get something prebaked.
		 */
		const standaloneQuestionChain = RunnableSequence.from([
			condenseQuestionPrompt,
			model,
			new StringOutputParser(),
		]);

		let resolveWithDocuments: (value: Document[]) => void;
		const documentPromise = new Promise<Document[]>((resolve) => {
			resolveWithDocuments = resolve;
		});

		const retriever = vectorstore.asRetriever({
			callbacks: [
				{
				handleRetrieverEnd(documents) {
					resolveWithDocuments(documents);
				},
				},
			],
		});

		const retrievalChain = retriever.pipe(combineDocumentsFn);

		const answerChain = RunnableSequence.from([
			{
				context: RunnableSequence.from([
					(input) => input.question,
					retrievalChain,
				]),
				chat_history: (input) => input.chat_history,
				question: (input) => input.question,
			},
			answerPrompt,
			model,
		]);

		const conversationalRetrievalQAChain = RunnableSequence.from([
			{
				question: standaloneQuestionChain,
				chat_history: (input) => input.chat_history,
			},
			answerChain,
			new BytesOutputParser(),
		]);

		const stream = await conversationalRetrievalQAChain.stream({
			question: currentMessageContent,
			chat_history: formatVercelMessages(previousMessages),
		});

		const documents = await documentPromise;
		const serializedSources = Buffer.from(
			JSON.stringify(
				documents.map((doc) => {
					return {
						pageContent: doc.pageContent.slice(0, 50) + "...",
						metadata: doc.metadata,
					};
				}),
			),
		).toString("base64");

		// return new StreamingTextResponse(
		// 	stream.pipeThrough(createStreamDataTransformer()),
		// 	{
			// 	headers: {
			// 		"x-message-index": (previousMessages.length + 1).toString(),
			// 		"x-sources": serializedSources,
			// 	},
		//  });


		const streamResult = createStreamTextResult(stream);
		return streamResult.toDataStreamResponse({
			"x-message-index": (previousMessages.length + 1).toString(),
			"x-sources": serializedSources,
		});
	} catch (e: any) {
		return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
	}
}

