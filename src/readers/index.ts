// 统一读取层：stdin / transcript / 终端宽度 三类读取的统一入口。
// 设计原则：关键路径（渲染前）只做同步、有界、零网络的读取；
// transcript 只做有上限的尾部流式读并落盘缓存。
export { readStdinData } from './stdin';
export { getLatestTranscriptUsage, readTailLines, type TranscriptUsage } from './transcript';
export { detectWidth } from './termwidth';
