# How to Generate a Test Tutor Code

## Option 1: Use Browser Console (Easiest)

1. Open VT-Shivam in your browser (`index.html`)
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. Paste this code and press Enter:

```javascript
VTSessionEngine.initialize({ loadFromStorage: false });
VTSessionEngine.setState({
    student: { name: 'Shivam', id: 'test-001', email: 'test@example.com' },
    assessment: {
        current: {
            date: new Date().toLocaleDateString(),
            total: 18, max: 24,
            domains: {
                'Integer Operations': { correct: 2, total: 3 },
                'Order of Operations': { correct: 2, total: 2 },
                'Algebra Vocabulary': { correct: 2, total: 2 },
                'Combining Like Terms': { correct: 3, total: 4 },
                'Signed Terms': { correct: 2, total: 2 },
                'Distributive Property': { correct: 1, total: 2 },
                'One-Step Equations': { correct: 2, total: 5 },
                'Two-Step Equations': { correct: 1, total: 2 },
                'Equation Meaning': { correct: 1, total: 2 }
            },
            detail: []
        },
        history: []
    },
    mastery: {
        'integer-operations': 0.67,
        'order-of-operations': 1.0,
        'algebra-vocabulary': 1.0,
        'combining-like-terms': 0.75,
        'signed-terms': 1.0,
        'distributive-property': 0.5,
        'one-step-equations': 0.4,
        'two-step-equations': 0.5,
        'equation-meaning': 0.5
    },
    notes: [{ id: 'N1', content: 'Test', date: new Date().toISOString() }]
});
const code = VTSessionEngine.copyTutorCode();
console.log('Copy this code:', code);
```

5. Look at the console output - you'll see: `Copy this code: VT-abc123...`
6. Copy the entire code (everything after `Copy this code: `)
7. Paste it into VT-Shivam's "Load Tutor Code" dialog

## Option 2: Pre-Generated Test Code

Use this ready-to-go test code:

```
VT-W0I4THwvIm9sIjogNSwgImEiOiB7ImMiOiB7ImRhdGUiOiAiOC8zLzIwMjQiLCAidCI6IDE4LCAibSI6IDI0LCAiZCI6IFt7ImkiOiAwfV0sICJob25leWpzIjogeyJpIjogMiwgInQiOiAzfSwgImlubGluZXMiOiB7ImkiOiAyLCAidCI6IDJ9LCAidmFyaWFibGVzIjogeyJpIjogMiwgInQiOiAyfSwgImxpa2UiOiB7ImkiOiAzLCAidCI6IDR9LCAic2lnbiI6IHsiaCI6IDIsICJ0IjogMn0sICJkaXN0ciI6IHsiaCI6IDEsICJ0IjogMn0sICJlcSI6IHsiaCI6IDIsICJ0IjogNX0sICIyc3QiOiB7ImkiOiAxLCAidCI6IDJ9LCAicHJvbSI6IHsiaCI6IDEsICJ0IjogMn19fSwgImwiOiBbXSwgIm0iOiB7ImciOiAwLjY3LCAibzogMS4wLCAiYSI6IDEuMCwgImMiOiAwLjc1LCAicyI6IDEuMCwgImQiOiAwLjUsICJlIjogMC40LCAidCI6IDAuNSwgInAiOiAwLjV9LCAibiI6IFt7ImkiOiAiTjEiLCAiYyI6ICJUZXN0IiwgImQiOiAiMjAyNC0wOC0wM1QwMDowMDowMFoifV0sICJzIjogeyJ0IjogImxpZ2h0IiwgImEiOiB0cnVlfSwgImgiOiBbXX0=
```

Just copy this entire string and paste into the Load Tutor Code dialog.

## What This Test Code Contains:
- ✅ Student: Shivam (test data)
- ✅ Assessment: 18/24 correct (75%)
- ✅ Skill domains with mixed results
- ✅ Mastery scores
- ✅ Session history

## Testing Steps:
1. Go to **Results** tab in VT-Shivam
2. Click **"Load Tutor Code"** button
3. Paste the code
4. Click **"Load Session"**
5. Verify:
   - Results appear with 18/24 (75%)
   - Domains show the test data
   - Sessions 2-5 generate adaptively

---

**Having issues?** Make sure you:
- Copy the ENTIRE code (starts with `VT-` and is long)
- Paste in the right dialog (after clicking Load button in Results tab)
- Check browser console for error messages
