"use client";
import { useState, useRef, FormEvent } from "react";
import { useCompletion } from "ai/react";
import Emoji from "@/components/Emoji";
import { Footer } from "@/components/Footer";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { 
  ClipIcon, 
  CloudUploadIcon, 
  TextBodyIcon, 
  LinkIcon, 
  SendIcon, 
  StopIcon 
} from "@/components/Icons";
import { toast } from "react-toastify";

const SummarizerPage = () => {
  const { data:session, status } = useSession();

  const [inputType, setInputType] = useState("text");

  const inputSectionRef = useRef(null);

  const [apiEndpoint, setApiEndpoint] = useState("app/api/chat/summarizer"); //useState("/api/completion/fireworksai");

  const handleApiEndpointChange = (event: { target: { value: any } }) => {
    setApiEndpoint("/api/completion/" + event.target.value);
  };

  // text OpenAI completion function call
  const {
    completion,
    input,
    setInput,
    stop,
    isLoading,
    handleInputChange,
    handleSubmit,
  } = useCompletion({
    api: apiEndpoint,
  });

  //extract text from a url input
  const getWebPageContent = async (e: FormEvent<HTMLFormElement>) => {
    const urlInput = document.getElementById("urlInput");

    // const pg_content_disp = document.getElementById("pg_content_disp");

    const url = urlInput?.textContent;
    console.log(url);

    e.preventDefault();
    // setIsLoading(true);

    // API call to parse web page content of user provided URL
    const response = await fetch("/api/webpage_parser", {
      method: "POST",
      body: JSON.stringify({
        text: url,
      }),
    });

    const json_resp = await response.json();

    if (response.status === 200 && json_resp.data) {
      // setReadyToChat(true);
      setInput(json_resp.data);
      toast(
        `Web page content retreived.`,
        {
          theme: "dark",
        }
      );
      handleSubmit(e);
    } else {
      // const json = await response.json();
      if (json_resp.error) {
        toast(
          `Unable to retreive web page content : ${json_resp.error}`,
          {
            theme: "dark",
          }
        );
      }
    }
  }

  // extractfile content of uploaded
  const getFileContent = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    //TO DO: API call to a langchain based document/file loader. returns file content as serialized strings
    handleSubmit(e);
  }

  // input section form specifications
  const summarizerCtrlButtons = (
    <div className="flex justify-end mt-2 space-x-6">
      {/* <label className="text-black" htmlFor="llm-selector">Select LLM: </label> */}

      {/* <select
        onChange={handleApiEndpointChange}
        className="inline-flex items-center py-1.5 px-2 font-medium text-center text-gray-200 bg-kaito-brand-ash-green rounded-md hover:bg-kaito-brand-ash-green mr-2 "
        id="llm-selector"
        required
      >
        <option value="">--Select LLM--</option>
        <option value="openai">GPT-3.5</option>
        <option value="fireworksai">Llama-2-Fwks</option>
        <option value="cohere">Co:here</option>
        <option value="huggingface">OpenAssistant-HF</option>
      </select>  */}
      <div>
        <button
          className="inline-flex bg-kaito-brand-ash-green hover:bg-kaito-brand-ash-green items-center font-medium text-gray-200 rounded-full px-4 py-4"
          type="button"
          onClick={stop}
        >
          <StopIcon />
        </button>
      </div>

      <div>
        <button
          className="inline-flex items-center py-4 px-4 font-medium text-center text-gray-200 bg-kaito-brand-ash-green rounded-full hover:bg-kaito-brand-ash-green"
          type="submit"
          disabled={isLoading}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );

  // raw text input form
  const textInputForm = (
    <form className="w-full flex flex-col" onSubmit={handleSubmit}>
      <div className="w-full mb-4 border border-kaito-brand-ash-green rounded-lg bg-gray-50">
        <div className="px-2 py-2 bg-white rounded-t-lg ">
          <textarea
            id="textInput"
            rows={4}
            className="w-full px-0 text-sm text-kaito-brand-ash-green bg-white border-0  focus:ring-0 focus:ring-inset focus:ring-kaito-brand-ash-green"
            value={input}
            onChange={handleInputChange}
            placeholder="Paste in the text you want to summarize..."
            required
          ></textarea>
        </div>

        <div className="items-center px-3 py-2 border-t ">
          {summarizerCtrlButtons}
        </div>
      </div>
    </form>
  );

  // text file input form
  const fileInputForm = (
    <form className="w-full flex flex-col" onSubmit={getFileContent}>
      <div className="w-full mb-4 border border-kaito-brand-ash-green rounded-lg bg-gray-50">
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full cursor-pointer bg-white  hover:bg-gray-50 rounded-t-lg"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <CloudUploadIcon />
              <p className="mb-2 text-sm text-gray-500 ">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500 ">DOC, DOCX, TXT or PDF</p>
            </div>
            <input id="dropzone-file" type="file" className="hidden" />
          </label>
        </div>

        <div className="items-center px-3 py-2 border-t ">
          {summarizerCtrlButtons}
        </div>
      </div>
    </form>
  );

  const urlInputBox = (
    <>
      <input
        type="url"
        id="urlInput"
        // className="bg-white hover:bg-gray-50 text-kaito-brand-ash-green text-sm rounded-t-lg border border-b-kaito-brand-gray focus:ring-gray-200 focus:border-gray-200 block w-full p-2.5"
        className="bg-white hover:bg-gray-50 text-kaito-brand-ash-green text-sm rounded-t-lg w-full border-x-0 border-t-0 border-b "
        placeholder="Type in the URL (http:// address) of webpage you want to summarize."
        // onChange={getWebPageContent}
        required
      />
    </>
  );

  const urlInputForm = (
    <form className="w-full flex flex-col" onSubmit={getWebPageContent}>
      <div className="w-full mb-4 border border-kaito-brand-ash-green rounded-lg bg-gray-50">
        <div className=" bg-white rounded-t-lg">
          {urlInputBox}

          <textarea
            id="pg_content_disp"
            rows={4}
            className="w-full px-0 text-sm text-kaito-brand-ash-green bg-white border-0 focus:ring-0 focus:ring-inset  focus:ring-kaito-brand-ash-green"
            value={input}
            onChange={handleInputChange}
            placeholder="  Preview of webpage content appears here ..."
            disabled={true}
          ></textarea>
        </div>

        <div className="items-center px-3 py-2 border-t ">
          {summarizerCtrlButtons}
        </div>
      </div>
    </form>
  );

  const sideNavBar = (
    <>
      <div className="flex grow-0 gap-2 ml-2.5 border-r border-slate-300 h-screen">
        <ul>
          <li className="p-3">
            <button
              type="button"
              className="inline-flex bg-kaito-brand-ash-green hover:bg-kaito-brand-ash-green items-center font-medium text-gray-200 rounded-full px-4 py-4 "
              onClick={() => {
                setInputType("text");
              }}
            >
              <TextBodyIcon />
              <span className="sr-only">Paste text</span>
            </button>
          </li>
          <li className="p-3">
            <button
              type="button"
              className="inline-flex bg-kaito-brand-ash-green hover:bg-kaito-brand-ash-green items-center font-medium text-gray-200 rounded-full px-4 py-4 "
              onClick={() => {
                setInputType("file");
              }}
            >
              <ClipIcon />
              <span className="sr-only">Attach file</span>
            </button>
          </li>

          <li className="p-3">
            <button
              type="button"
              className="inline-flex bg-kaito-brand-ash-green hover:bg-kaito-brand-ash-green items-center font-medium text-gray-200 rounded-full px-4 py-4 "
              onClick={() => {
                setInputType("url");
              }}
            >
              <LinkIcon />
              <span className="sr-only">paste URL of webpage to summarize</span>
            </button>
          </li>
          {/* <li className="p-3"></li> */}
        </ul>
      </div>
    </>
  );

  return (
    <>
      {status === "authenticated" && (
        <div className="flex flex-auto max-w-2xl pb-5 mx-auto mt-4 sm:px-4 grow">
          {completion.length > 0 && (
            <output className="flex flex-col text-sm sm:text-base text-gray-700 flex-1 gap-y-4 mt-1 gap-x-4 rounded-md bg-gray-50 py-5 px-5 pb-80 grow">
              {completion}
            </output>
          )}

          {completion.length == 0 && (
            <>
              {sideNavBar}

              <div className="flex flex-col p-4 md:p-8 bg-[#25252d00] overflow-hidden grow h-screen">
                <h1 className="text-center text-3xl md:text-3xl mb-4 text-gray-700">
                  Summarize your documents and web pages.
                </h1>

                <p className="text-black text-lg text-center">
                  Specify text source on the left. Get a summary. You can ask
                  follow up questions.
                </p>

                <br></br>

                <div className="container max-w-2xl ">
                  {inputType === "text" && textInputForm}
                  {inputType === "file" && fileInputForm}
                  {inputType === "url" && urlInputForm}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {status === "unauthenticated" && redirect("/auth/signIn")};
      <Footer />
    </>
  );
}

export default SummarizerPage;
