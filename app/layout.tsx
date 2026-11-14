import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'AJIL — Япон дахь ажлын боломж',description:'Монгол хэлээр ажил хайж, өөрийн боломжийг бүтээ.',manifest:'/manifest.json',icons:{icon:'/icon.svg',apple:'/icon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="mn"><body>{children}</body></html>}
