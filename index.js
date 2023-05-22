
require('dotenv').config();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { Configuration, OpenAIApi } = require('openai');


// initialize express and any middleware
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));


// Initialize Twilio client and OpenAI
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// User data
const users = {
    '$(process.env.USER1_NUMBER)': "English",
    "$(process.env.USER1_NUMBER)": "Mexico Spanish"
}

let context = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'serverPage.html'));
});

// Route for handling incoming SMS messages
app.post('/sms', async (req, res) => {
    const message = req.body.Body;
    const sender = req.body.From;

    try {
        const userLanguage = users[sender];
        const targetLanguage = Object.values(users).find(lang => lang !== userLanguage);
        console.log(`Translating ${userLanguage} text to ${targetLanguage}: ${message}`);    
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: `Translate the following ${userLanguage} text from ${sender} to ${targetLanguage}: ${message}\n\n conversationContext: ${JSON.stringify(context)} \n optimize the translation for the best results given the past messages in the conversation. Do not include anything else in the response, context is only meant for added context of the last messages in the conversation you are translating for.`,
            max_tokens: 800,
        });

        console.log(`Translated message: ${response.data.choices[0].text}`);
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
        const twilioMessage = response.data.choices[0].text;
        await client.messages.create({
            body: twilioMessage,
            from: twilioPhoneNumber,
            to: Object.keys(users).find(number => number !== sender)
        });
        console.log(`Sent message: ${twilioMessage}`);
        context.push({sender, message});
              
        if (context.length > 2) {
            context.shift();
            console.log(`Current context: ${JSON.stringify(context)}`);
        }
    } catch (error) {
        console.log('ERROR');
        if (error.response) {
            console.log(`Error status: ${error.response.status}`);
            console.log(`Error data: ${error.response.data}`);
        } else {
            console.log(`Error message: ${error.message}`);
        }
    }

    res.send('Message NOT sent!');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


