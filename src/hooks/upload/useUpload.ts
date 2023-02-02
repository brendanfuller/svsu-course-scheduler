import { useState } from "react";
import axios from "axios";

const defaults = {};

const defaultOptions = {
  getSignedUrlOptions: {
    method: "get",
  },
  ...defaults,
};

interface UploadParameters {
  [name: string]: string;
}

const useRestUpload = (url: string) => {
  //Progress and uploading state
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, params?: UploadParameters) => {
    setUploading(true);

    //Create a form for uploading to the database
    const dataForm = new FormData();
    dataForm.append("file", file);

    //Add all parameters for the value
    for (const param in params) {
      const value = params[param];
      //Make sure the value
      if (value != undefined) {
        dataForm.append(param, value);
      }
    }
    //Now set the axios post out
    await axios({
      method: "post",
      data: dataForm,
      url,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total != undefined) {
          const newProgress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(newProgress);
        }
      },
    });

    //Now we are not uploading anymore
    setUploading(false);
  };

  //Progress reset
  const reset = () => {
    setProgress(0);
  };

  //Upload the files
  return { upload, progress, uploading, reset };
};

export default useRestUpload;
