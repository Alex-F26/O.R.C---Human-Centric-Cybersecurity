import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.min.css";
import surveyJson from "../surveys/orc.json";

export default function SurveyWrapper() {
  const survey = new Model(surveyJson);

  survey.onComplete.add((sender) => {
    console.log("Survey data:", sender.data);
    // TODO: send sender.data to backend so we have stuff to analyze
  });

  return <Survey model={survey} />;
}