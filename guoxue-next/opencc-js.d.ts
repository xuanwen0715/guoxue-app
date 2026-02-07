declare module 'opencc-js' {
  export interface ConverterOptions {
    from: string;
    to: string;
  }
  
  export function Converter(options: ConverterOptions): (text: string) => string;
  
  // 为了兼容 CommonJS 导入方式
  namespace OpenCC {
    function Converter(options: ConverterOptions): (text: string) => string;
  }
  
  export default OpenCC;
}
