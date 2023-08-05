const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());
app.options('*', cors());

const apiKey = "2e6d524589ed47b0a384cc505582d1c7";

app.get('/recipe', async (req, res) => {
  const query = req.query.query;
  try {
    const response = await axios.get(`https://api.spoonacular.com/recipes/complexSearch?apiKey=${apiKey}&query=${query}&number=1`);
    const recipes = response.data.results;

    if (recipes.length > 0) {
      const recipe = recipes[0];
      const details = await getRecipeDetails(recipe.id);
      const ingredients = await extractIngredients(details.steps);
      const formattedMessage = formatRecipeMessage(details, ingredients);
      res.json({ message: formattedMessage });
    } else {
      const recipeFromWeb = await searchWebForRecipe(query);
      res.json({ message: recipeFromWeb });
    }
  } catch (error) {
    res.json({ message: "Sorry, I couldn't find any recipes for that." });
  }
});

function formatRecipeMessage(details, ingredients) {
  const { name, duration, steps } = details;

  const formattedIngredients = ingredients.map(ingredient => `- ${ingredient}`);
  const formattedSteps = steps.map(step => `Step ${step}`);

  const formattedMessage = [
    `Name of the recipe: ${name}`,
    `Duration: ${duration}`,
    'Ingredients required:',
    ...formattedIngredients,
    'Steps:',
    ...formattedSteps
  ];

  return formattedMessage.join('\n');
}


async function getRecipeDetails(id) {
  const response = await axios.get(`https://api.spoonacular.com/recipes/${id}/information?apiKey=${apiKey}`);
  const recipe = response.data;

  const details = {
    name: recipe.title,
    duration: `${recipe.readyInMinutes} minutes`,
    steps: recipe.analyzedInstructions[0].steps.map(step => `Step ${step.number}: ${step.step}`),
  };

  return details;
}

async function searchWebForRecipe(query) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.google.com/search?q=' + query + '+recipe');

  const results = await page.evaluate(() => {
    let links = Array.from(document.querySelectorAll('.yuRUbf a')).map((link) => link.href);
    return links[0]; // return the first link
  });

  // Now visit the first link and try to scrape the recipe details
  await page.goto(results);

  const recipeDetails = await page.evaluate(() => {
    // Update the selectors below with the correct selectors for the recipe details
    let recipeName = document.querySelector('selector-for-recipe-name').innerText;
    let recipeDuration = document.querySelector('selector-for-recipe-duration').innerText;
    let recipeSteps = Array.from(document.querySelectorAll('selector-for-recipe-steps')).map((step) => step.innerText);

    return { recipeName, recipeDuration, recipeSteps };
  });

  await browser.close();

  return recipeDetails; // return the scraped recipe details
}

async function extractIngredients(details) {
  const ingredients = details.steps.reduce((result, step) => {
    const matches = step.match(/[\w\s-]+/g);
    if (matches) {
      result.push(...matches);
    }
    return result;
  }, []);

  return ingredients;
}

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '/build')));
// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname+'/build/index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
