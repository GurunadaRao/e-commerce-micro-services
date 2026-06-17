require("./src/observability/tracing");
require("dotenv").config();
const App = require("./src/app");

const app = new App();
app.start();
