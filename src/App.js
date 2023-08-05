import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  let messageId = 0;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    messageId += 1;
    setMessages([...messages, { id: messageId, text: input, from: 'user' }]);
    setInput('');

    const response = await axios.get(`http://localhost:5000/recipe?query=${input}`);
    messageId += 1;
    const recipeInfo = await processRecipeInfo(response.data.message);
    setMessages(prevMessages => [...prevMessages, ...recipeInfo]);
  }, [input, messages]);

  const processRecipeInfo = async (recipeMessage) => {
    if (typeof recipeMessage !== 'string') {
      console.error('Invalid recipe message:', recipeMessage);
      return [];
    }

    const lines = recipeMessage.split('\n');
    const name = lines[0].split(': ')[1];
    const duration = lines[1].split(': ')[1];
    const recipeLines = lines.slice(2, lines.length);

    const ingredientsStartIndex = recipeLines.findIndex(line => line.toLowerCase().includes('ingredients'));
    const procedureStartIndex = recipeLines.findIndex(line => line.toLowerCase().includes('procedure'));
    const ingredients = recipeLines
      .slice(ingredientsStartIndex + 1, procedureStartIndex)
      .filter(line => line.trim() !== '');

    // Extract ingredients using spaCy
    const extractedIngredients = await extractIngredients(ingredients);

    const procedure = recipeLines.slice(procedureStartIndex + 1).join('\n').split('Step');

    const formattedMessages = [
      { id: messageId, text: `Name of the recipe: ${name}`, from: 'bot' },
      { id: messageId + 1, text: `Duration: ${duration}`, from: 'bot' },
      { id: messageId + 2, text: 'Ingredients required:', from: 'bot' },
      ...extractedIngredients.map((ingredient, index) => ({
        id: messageId + 3 + index,
        text: `- ${ingredient}`,
        from: 'bot',
      })),
      { id: messageId + 3 + extractedIngredients.length, text: 'Steps:', from: 'bot' },
      ...procedure.map((step, index) => {
        if (step.trim() !== '') {
          return { id: messageId + 4 + extractedIngredients.length + index, text: `Step ${step}`, from: 'bot' };
        }
        return null;
      }).filter(item => item !== null),
    ];

    return formattedMessages;
  };

  const extractIngredients = async (ingredients) => {
    try {
      const response = await axios.post('http://localhost:5000/extract-ingredients', { ingredients });
      return response.data.ingredients;
    } catch (error) {
      console.error('Failed to extract ingredients:', error);
      return [];
    }
  };

  return (
    <div className="chat-container">
      <div className="message-area">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.from}`}>
            {message.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default App;
