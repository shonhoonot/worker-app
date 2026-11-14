import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import DeleteForm from './delete-form';

export const dynamic = 'force-dynamic';

export default async function DeleteAccountData() {
  const user = await getChatGPTUser();
  return (
    <main className="inner-main">
      <section className="account">
        <a href="/">← AJIL руу буцах</a>
        <h1>AJIL дахь мэдээллээ устгах</h1>
        <p>Таны оруулсан бүх зар, ажилд өгсөн хүсэлтүүд, хадгалсан ажлууд, блок болон илгээсэн гомдол серверээс бүрмөсөн устана. Таны зарууд бусад хэрэглэгчийн ажилд өгсөн хүсэлтүүд, хадгалсан жагсаалтаас мөн арилна.</p>
        <p>Энэ үйлдэл зөвхөн AJIL-д хамаарна. Та дараа нь ChatGPT бүртгэлээрээ дахин нэвтэрч, шинээр зар оруулж болно.</p>
        {user ? <DeleteForm displayName={user.displayName}/> : (
          <a className="primary" target="_top" href={chatGPTSignInPath('/account/delete')}>Бүртгэлээрээ нэвтрэх</a>
        )}
      </section>
    </main>
  );
}
