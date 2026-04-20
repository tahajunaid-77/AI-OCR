import { Application } from 'express'
import { API_ROOT } from '../constant/application'

import General from './router'

const App = (app: Application) => {
    app.use(`${API_ROOT}`, General)
}

export default App
