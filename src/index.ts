/**
 *****************************************
 * Created by edonet@163.com
 * Created on 2025-10-21 20:05:56
 *****************************************
 */
'use strict';


/**
 *****************************************
 * 参数定义
 *****************************************
 */
const PREFIX = '/';


/**
 *****************************************
 * 匹配资源
 *****************************************
 */
const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i


/**
 *****************************************
 * 导出接口
 *****************************************
 */
export default {
	async fetch(request: Request): Promise<Response> {
		try {
			return await handleRequest(request)
		} catch (err) {
			return new Response('cfworker error:\n' + (err as Error).stack, {
				status: 502,
				headers: { 'access-control-allow-origin': '*' }
			});
		}
	},
};


/**
 *****************************************
 * 处理请求
 *****************************************
 */
async function handleRequest(request: Request) {
    const url = new URL(request.url)

    // 处理查询参数
    const search = url.searchParams.get('q')
    if (search) {
        return Response.redirect('https://' + url.host + PREFIX + search, 301)
    }

    // 替换资源地址
    const path = url.href
        .slice(url.origin.length + PREFIX.length)
        .replace(/^https?:\/+/, 'https://')

    // 匹配路径
    if ([exp1, exp3, exp4, exp5, exp6].some(exp => exp.test(path))) {
        return handleHTTP(request, path)
    } else if (exp2.test(path)) {
        return handleHTTP(request, path.replace('/blob/', '/raw/'));
    } else {
        return new Response('404 Not Found', { status: 404 })
    }
}


/**
 *****************************************
 * 处理 HTTP
 *****************************************
 */
function handleHTTP(request: Request, path: string) {
    const headers = request.headers

    // 处理预检请求
    if (request.method === 'OPTIONS' && headers.has('access-control-request-headers') ) {
        return new Response(null, {
            status: 204,
            headers: new Headers({
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS',
                'access-control-max-age': '1728000',
            }),
        })
    }

    // 处理代理
    const url = path.startsWith('http') ? path : 'https://' + path;
    return handleProxy(url, {
        method: request.method,
        body: request.body,
        redirect: 'manual',
        headers: new Headers(headers),
    })
}


/**
 *****************************************
 * 处理请求
 *****************************************
 */
async function handleProxy(url: string, reqInit: RequestInit) {
    const res = await fetch(url, reqInit)
    const headers = new Headers(res.headers)

    // 处理重定向
    const location = headers.get('location');
    if (location) {
        if ([exp1, exp2, exp3, exp4, exp5, exp6].some(exp => exp.test(location))) {
            headers.set('location', PREFIX + location)
        } else {
            reqInit.redirect = 'follow'
            return handleProxy(location, reqInit)
        }
    }

    // 更新请求头
    headers.set('access-control-expose-headers', '*')
    headers.set('access-control-allow-origin', '*')
    headers.delete('content-security-policy')
    headers.delete('content-security-policy-report-only')
    headers.delete('clear-site-data')

    // 返回内容
    return new Response(res.body, { status: res.status, headers })
}

