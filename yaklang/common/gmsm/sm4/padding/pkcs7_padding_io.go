package padding

import (
	"bytes"
	"errors"
	"io"
)

type PaddingReaderWrapper func(io.Reader, int) PaddingReader
type PaddingWriterWrapper func(io.Writer, int) PaddingWriter

type PaddingReader interface {
	ReadBlock() ([]byte, error)
	io.Reader
}

type PaddingWriter interface {
	io.Writer
	Final() error
}

// PKCSPaddingReader 符合PKCS#7填充的输入流
type PKCSPaddingReader struct {
	fIn       io.Reader
	padding   []byte
	blockSize int
	readed    int64
	eof       bool
	eop       bool
}

// NewPKCSPaddingReader 创建PKCS7填充Reader
// in: 输入流
// blockSize: 分块大小
func NewPKCSPaddingReader(in io.Reader, blockSize int) PaddingReader {
	return &PKCSPaddingReader{
		fIn:       in,
		padding:   nil,
		eof:       false,
		eop:       false,
		blockSize: blockSize,
	}
}

func (p *PKCSPaddingReader) ReadBlock() ([]byte, error) {
	if p.eof && p.eop {
		return nil, io.EOF
	}

	buf := make([]byte, p.blockSize)
	var off = 0
	if !p.eof {
		// read from reader
		n, err := io.ReadFull(p.fIn, buf)
		if err == nil {
			return buf, nil
		}
		p.readed += int64(n)
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			p.eof = true
			p.newPadding()
			if n >= p.blockSize {
				return buf, nil
			}
			off = n
		} else {
			return nil, err
		}
	}

	if !p.eop {
		if len(p.padding) == p.blockSize-off {
			copy(buf[off:], p.padding)
			p.eop = true
		}
	}
	return buf, nil
}

func (p *PKCSPaddingReader) Read(buf []byte) (int, error) {
	/*
		- 读取文件
			- 文件长度充足， 直接返还
			- 不充足
		- 读取到 n 字节， 剩余需要 m 字节
		- 从 padding 中读取然后追加到 buff
			- EOF  直接返回， 整个Reader end
	*/
	// 都读取完了
	if p.eof && p.eop {
		return 0, io.EOF
	}

	var n, off = 0, 0
	var err error
	if !p.eof {
		// 读取文件
		n, err = p.fIn.Read(buf)
		if err != nil && !errors.Is(err, io.EOF) {
			// 错误返回
			return 0, err
		}
		p.readed += int64(n)
		if errors.Is(err, io.EOF) {
			// 标志文件结束
			p.eof = true
			p.newPadding()
		}
		if n == len(buf) {
			// 长度足够直接返回
			return n, nil
		}
		off = n
	}

	if !p.eop {
		if len(p.padding) == p.blockSize-off {
			copy(buf[off:], p.padding)
			p.eop = true
			n += len(p.padding)
		}
	}
	return n, err
}

// 新建Padding
func (p *PKCSPaddingReader) newPadding() {
	if p.padding != nil {
		return
	}
	size := p.blockSize - int(p.readed%int64(p.blockSize))
	p.padding = bytes.Repeat([]byte{byte(size)}, size)
}

// PKCSPaddingWriter 符合PKCS#7去除的输入流，最后一个 分组根据会根据填充情况去除填充。
type PKCSPaddingWriter struct {
	cache     *bytes.Buffer // 缓存区
	out       io.Writer     // 输出位置
	blockSize int           // 分块大小
}

// NewPKCSPaddingWriter PKCS#7 填充Writer 可以去除填充
func NewPKCSPaddingWriter(out io.Writer, blockSize int) PaddingWriter {
	cache := bytes.NewBuffer(make([]byte, 0, 1024))
	return &PKCSPaddingWriter{out: out, blockSize: blockSize, cache: cache}
}

// Write 保留一个填充大小的数据，其余全部写入输出中
func (p *PKCSPaddingWriter) Write(buff []byte) (n int, err error) {
	// 写入缓存
	n, err = p.cache.Write(buff)
	if err != nil {
		return 0, err
	}
	if p.cache.Len() > p.blockSize {
		size := p.cache.Len() - p.blockSize
		swap := make([]byte, size)
		_, _ = p.cache.Read(swap)
		_, err = p.out.Write(swap)
		if err != nil {
			return 0, err
		}
	}
	return n, err
}

// Final 去除填充写入最后一个分块
func (p *PKCSPaddingWriter) Final() error {
	b := p.cache.Bytes()
	length := len(b)
	if length%p.blockSize != 0 {
		return errors.New("非法的PKCS填充")
	}
	unPadding := int(b[length-1])
	if unPadding > p.blockSize {
		return errors.New("非法的PKCS填充")
	}
	_, err := p.out.Write(b[:(length - unPadding)])
	return err
}
