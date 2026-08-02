import {OLLAMA_SERVER} from "./API.ts";

/**
 * 辅助函数：按行解析 NDJSON 流（修正 onprogress 中半行 JSON 的 bug）
 */
function streamNdj(
    xhr: XMLHttpRequest,
    onLine: (lineStr: string) => void,
    onError: (err: any) => void,
) {
    let lineBuffer = '';                    // 累积未完成的行数据
    let lastProcessedLen = 0;              // 已处理的字符数（避免重复 split 整个 responseText）

    xhr.onprogress = function () {
        const fullText = xhr.responseText;                // 当前累积的全部响应文本
        const newChunk = fullText.substring(lastProcessedLen); // 从上次结束位置开始的增量
        if (newChunk.length === 0) return;

        lineBuffer += newChunk;
        lastProcessedLen = fullText.length;

        // 按 \n 分割所有行（含上次残留）
        const lines = lineBuffer.split('\n');
        // 最后一段可能不完整，保留到下次
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') continue;
            onLine(trimmed);
        }
    };

    // 请求完成时处理最后残留行
    const onFinish = () => {
        const trimmed = lineBuffer.trim();
        if (trimmed !== '') {
            onLine(trimmed);
        }
        lineBuffer = '';
    };

    return { onFinish };
}

// ============================= pull（下载模型）=============================
export const pull = (
    modelName: string,
    pullResponseCallback: (response: PullResponse) => void,
    maxRetries: number = 3,
): PullSessionType => {
    let aborted = false;
    let currentXhr: XMLHttpRequest | null = null;

    const attempt = (): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            currentXhr = xhr;

            xhr.open('POST', `${OLLAMA_SERVER}/api/pull`);
            xhr.setRequestHeader('Content-Type', 'application/json');

            const ndj = streamNdj(
                xhr,
                (line) => {
                    try {
                        const response: PullResponse = JSON.parse(line);
                        pullResponseCallback(response);
                    } catch (parseErr) {
                        // 单行解析失败不中断整个下载，仅记录警告
                        console.warn('[pull] parse line error:', parseErr, 'line:', line);
                    }
                },
                (err) => reject(err),
            );

            xhr.onload = function () {
                ndj.onFinish(); // 处理最后一截行
                if (xhr.status === 200) {
                    resolve();
                } else {
                    reject(new Error(`HTTP Error: ${xhr.status}`));
                }
            };

            xhr.onerror = function () {
                reject(new Error('Network Error'));
            };

            xhr.send(JSON.stringify({ model: modelName }));
        });
    };

    const promise: Promise<void> = (async () => {
        let lastError: any;
        for (let i = 0; i < maxRetries; i++) {
            if (aborted) throw new Error('Request aborted');
            try {
                await attempt();
                return; // 成功
            } catch (e: any) {
                lastError = e;
                if (aborted) throw new Error('Request aborted');
                // ollama pull 支持断点续传，等待后重试
                if (i < maxRetries - 1) {
                    console.warn(`[pull] attempt ${i + 1} failed, retrying in 2s...`, e?.message);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
        throw lastError || new Error('Pull failed after all retries');
    })();

    return {
        promise,
        abort: () => {
            aborted = true;
            currentXhr?.abort();
        },
    };
};

// ============================= tags（获取模型列表）=============================
export const tags = async (): Promise<OllamaTagResponse> => {
    const response = await fetch(`${OLLAMA_SERVER}/api/tags`);
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return await response.json();
};

export const loadModel = async (modelName: string): Promise<LoadResponse> => {
    const response = await fetch(`${OLLAMA_SERVER}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelName }),
    });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return await response.json();
};

// ============================= chat（对话消息流）=============================
export interface ChatOptions {
    temperature?: number;
    top_p?: number;
    num_ctx?: number;
}

export const chat = (
    modelName: string,
    messages: Message[],
    chatResponseCallback: (chatResponse: ChatResponse) => void,
    options?: ChatOptions,
): ChatSessionType => {
    const xhr = new XMLHttpRequest();

    const promise: Promise<void> = new Promise((resolve, reject) => {
        const ndj = streamNdj(
            xhr,
            (line) => {
                try {
                    const response: ChatResponse = JSON.parse(line);
                    chatResponseCallback(response);
                } catch (parseErr) {
                    console.warn('[chat] parse line error:', parseErr, 'line:', line);
                }
            },
            (err) => reject(err),
        );

        xhr.open('POST', `${OLLAMA_SERVER}/api/chat`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function () {
            ndj.onFinish();
            if (xhr.status === 200) {
                resolve();
            } else {
                reject(new Error(`HTTP Error: ${xhr.status}`));
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network Error'));
        };

        // 组装请求体，仅传入显式设置过的采样参数
        const body: any = { model: modelName, messages: messages };
        if (options) {
            const o: any = {};
            if (options.temperature !== undefined) o.temperature = options.temperature;
            if (options.top_p !== undefined) o.top_p = options.top_p;
            if (options.num_ctx !== undefined && options.num_ctx > 0) o.num_ctx = options.num_ctx;
            if (Object.keys(o).length > 0) body.options = o;
        }

        xhr.send(JSON.stringify(body));
    });

    return {
        promise,
        abort: () => {
            xhr.abort();
        },
    };
};

// 获取正在运行模型
export const ps = async (): Promise<OllamaPsResponse> => {
    const response = await fetch(`${OLLAMA_SERVER}/api/ps`);
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return await response.json();
};

// 删除模型
export const deleteModel = async (modelName: string): Promise<void> => {
    const response = await fetch(`${OLLAMA_SERVER}/api/delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: modelName }),
    });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
};

// 卸载运行模型
export const unload = async (modelName: string): Promise<LoadResponse> => {
    const response = await fetch(`${OLLAMA_SERVER}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: modelName,
            messages: [],
            keep_alive: 0,
        }),
    });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    return await response.json();
};

// ============================= create（导入模型）=============================
export const create = (
    modelName: string,
    files: Record<string, string>,
    template: string,
    systemPrompt: string,
    createResponseCallback: (response: CreateResponse) => void,
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        const ndj = streamNdj(
            xhr,
            (line) => {
                try {
                    const response: PullResponse = JSON.parse(line);
                    createResponseCallback(response);
                } catch (parseErr) {
                    console.warn('[create] parse line error:', parseErr, 'line:', line);
                }
            },
            (err) => reject(err),
        );

        xhr.open('POST', `${OLLAMA_SERVER}/api/create`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function () {
            ndj.onFinish();
            if (xhr.status === 200) {
                resolve();
            } else {
                reject(new Error(`HTTP Error: ${xhr.status}`));
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network Error'));
        };

        xhr.send(JSON.stringify({
            model: modelName,
            files: files,
            template: template,
            system: systemPrompt,
        }));
    });
};
