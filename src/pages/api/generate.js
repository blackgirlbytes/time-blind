/**
 * This function is an API endpoint that generates a task breakdown using OpenAI's GPT-4 model.
 * It expects a POST request with a body containing a 'tasks' property.
 * If the OpenAI API key is not configured or if the 'tasks' property is not provided, it responds with an error.
 * If the OpenAI API request fails, it responds with the error returned by the OpenAI API.
 * If the OpenAI API request is successful, it responds with the generated task breakdown.
 *
 * @param {Object} req - The request object. It should have a 'body' property with a 'tasks' property.
 * @param {Object} res - The response object. It is used to send the response back to the client.
 * @returns {Promise<void>} - A Promise that resolves when the response has been sent.
 */
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function (req, res) {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      }
    });
    return;
  }

  const task = req.body.tasks || '';
  if (task === '') {
    res.status(400).json({
      error: {
        message: "Please enter a valid task",
      }
    });
    return;
  }

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4", // Using GPT-4
      messages: [
        { "role": "user", "content": `You are a helpful planning assistant. Please help me break down the following task on my to-do list with an estimated time that it could take: ${task}` },
      ],
    });

    const result = completion.data.choices[0].message.content;
    res.status(200).json({ result });
  } catch (error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        }
      });
    }
  }
}
