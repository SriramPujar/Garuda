import { streamText } from 'ai';
console.log('streamText type:', typeof streamText);

try {
    const result = streamText({
        model: { provider: 'test' }, // Dummy
        messages: []
    });
    console.log('Result keys:', Object.keys(result));
} catch (e) {
    console.log('streamText call failed (expected w/o model):', e.message);
}
