# Testing the /api/store/baseline Endpoint

## Option 1: Browser DevTools (Easiest)

1. **Open your app in the browser** (logged in)
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. **Go to Console tab**
4. **Paste and run:**

```javascript
fetch('/api/store/baseline', {
  method: 'POST',
  credentials: 'include'
})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err))
```

## Option 2: Add a Test Button to Dashboard

Add a button to your dashboard page to trigger the sync.

## Option 3: Using curl (Terminal)

```bash
# First, get your session cookie from browser DevTools → Application → Cookies
# Then run:
curl -X POST http://localhost:3000/api/store/baseline \
  -H "Cookie: __session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

## Option 4: Using Postman or Insomnia

1. **URL:** `http://localhost:3000/api/store/baseline`
2. **Method:** POST
3. **Headers:**
   - `Content-Type: application/json`
4. **Cookies:** Import from browser (or manually add Clerk session cookie)

## Option 5: Create a Test Page

Create a simple page with a button to test the endpoint.


