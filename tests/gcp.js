import axios from "axios";

const apiKey =process.env.GCP_KEY; 
const searchEngineId = process.env.GCP_SEARCH_ENGINE_ID; 
const query = 'What are the new hotels recently open in Jabalpur, India?'; 

const url = `https://www.googleapis.com/customsearch/v1`;

axios.get(url, {
  params: {
    key: apiKey,
    cx: searchEngineId,
    q: query
  }
})
.then(response => {
  console.log(response.data); 
})
.catch(error => {
  console.error('Error:', error);
});
