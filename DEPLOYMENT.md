# 🚀 Deployment Guide: Getting Your Public Links

Follow these steps to host your project online so anyone can access it!

## 1. Push your code to GitHub
Before hosting, your project needs to be on GitHub.

1.  Create a new repository on GitHub.
2.  Open your terminal in the `secure-login-demo` folder.
3.  Run:
    ```bash
    git init
    git add .
    git commit -m "Prepare for deployment"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git push -u origin main
    ```

## 2. Host the Backend (Server) on Render
This will give you your **public API link**.

1.  Go to [Render.com](https://render.com) and sign in.
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  Set the **Root Directory** to `server`.
5.  Set **Build Command** to: `npm install`
6.  Set **Start Command** to: `node server.js`
7.  Deploy! Once it's live, copy the URL (e.g., `https://my-server.onrender.com`).

## 3. Connect Frontend to Backend
1.  Open `user/app.js` and `developer/dashboard.js`.
2.  Change `const API = 'http://localhost:3000';` to your Render URL:
    ```javascript
    const API = 'https://my-server.onrender.com';
    ```
3.  Commit and push changes: `git add . && git commit -m "Update API URL" && git push`

## 4. Host the Frontend (User Portal & Developer Dashboard)
You can use **Netlify** or **GitHub Pages**.

### Using Netlify (Easiest)
1.  Go to [Netlify.com](https://netlify.com).
2.  Click **Import from GitHub**.
3.  Choose your repository.
4.  **Important**: Since you have two frontends, you can deploy them separately:
    *   **User Portal**: Set "Base directory" to `user`. URL will be like `https://funny-cat-123.netlify.app`.
    *   **Dev Dashboard**: Set "Base directory" to `developer`. URL will be like `https://smart-dog-456.netlify.app`.

---

### Your Final Links will look like this:
*   **User Portal**: `https://your-user-portal.netlify.app`
*   **Developer Dashboard**: `https://your-dev-dashboard.netlify.app`
*   **Server (API)**: `https://your-api.onrender.com`
