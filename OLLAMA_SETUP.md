# Ollama Setup Guide

This guide explains how to set up and use Ollama as an LLM provider in the CareerFavor application.

## What is Ollama?

Ollama is a tool that allows you to run large language models locally on your machine. This provides several benefits:

- **Privacy**: Your data never leaves your machine
- **Cost**: No API costs for model usage
- **Speed**: No network latency for model requests
- **Offline**: Works without internet connection

## Prerequisites

1. **Install Ollama**: Download and install Ollama from [https://ollama.ai](https://ollama.ai)
2. **Install a Model**: Download a model using Ollama (e.g., `ollama pull llama3.2`)

## Setup Steps

### 1. Start Ollama Server

```bash
# Start the Ollama server (usually runs on http://localhost:11434)
ollama serve
```

### 2. Install a Model

```bash
# Install a recommended model (choose one)
ollama pull llama3.2        # Meta's Llama 3.2 (recommended)
ollama pull llama3.1        # Meta's Llama 3.1
ollama pull mistral         # Mistral 7B
ollama pull codellama       # Code Llama (good for technical tasks)
ollama pull phi3            # Microsoft Phi-3
```

### 3. Verify Installation

```bash
# List installed models
ollama list

# Test a model
ollama run llama3.2 "Hello, how are you?"
```

### 4. Configure in CareerFavor

1. Open the CareerFavor application
2. Go to HR Settings → AI Model Configuration
3. Select "Ollama (Local)" as the LLM Provider
4. Enter the Ollama Base URL:
   - `127.0.0.1:11434` (recommended - http:// will be added automatically)
   - `http://localhost:11434` (full URL format)
   - `http://192.168.1.100:11434` (if Ollama is on another machine)
5. Enter your model name in the text field (e.g., `llama3.2:3b`, `mistral`, `codellama`)
6. Click "Save Configuration"

## Supported Models

You can use any model that you have installed in Ollama. Popular models include:

- **llama3.2** - Meta's latest Llama model (recommended)
- **llama3.1** - Meta's Llama 3.1 model
- **llama3** - Meta's Llama 3 model
- **llama2** - Meta's Llama 2 model
- **mistral** - Mistral 7B model
- **codellama** - Code Llama (good for technical CVs)
- **phi3** - Microsoft Phi-3 model
- **qwen** - Alibaba's Qwen model
- **gemma** - Google's Gemma model

**Note**: Enter the exact model name as it appears when you run `ollama list`.

## Troubleshooting

### Ollama Server Not Starting

```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama manually
ollama serve
```

### Connection Issues

1. **Check URL**: Ensure the base URL is correct (usually `http://localhost:11434`)
2. **Check Firewall**: Ensure no firewall is blocking the connection
3. **Check Port**: Verify Ollama is running on the expected port

### Model Not Found

```bash
# List available models
ollama list

# Pull a specific model
ollama pull <model-name>
```

### Performance Issues

- **RAM**: Ensure you have enough RAM for the model (4-8GB for 7B models)
- **GPU**: Ollama will use GPU if available for better performance
- **Model Size**: Smaller models (7B) are faster but less capable than larger ones (70B)

## Advanced Configuration

### Custom Ollama Server

If you're running Ollama on a different machine or port:

1. Update the Base URL in CareerFavor settings
2. Ensure the Ollama server is accessible from your CareerFavor instance
3. Test the connection using the validation feature

### Model Customization

You can create custom model configurations in Ollama:

```bash
# Create a custom model file
# See Ollama documentation for Modelfile syntax
ollama create my-custom-model -f Modelfile
```

## Benefits of Using Ollama

1. **Data Privacy**: All processing happens locally
2. **No API Costs**: No per-token charges
3. **Offline Capability**: Works without internet
4. **Custom Models**: Use your own fine-tuned models
5. **Consistent Performance**: No rate limiting or API downtime

## Performance Comparison

| Model Size | RAM Required | Speed | Quality |
|------------|--------------|-------|---------|
| 7B         | 4-8GB       | Fast  | Good    |
| 13B        | 8-16GB      | Medium| Better  |
| 70B        | 40-80GB     | Slow  | Best    |

Choose based on your hardware capabilities and quality requirements.
