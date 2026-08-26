import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const SignOutButton = ({ className = "" }: { className?: string }) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={`adm-signout ${className}`}
      onClick={async () => {
        await signOut();
        navigate("/", { replace: true });
      }}
    >
      Sign out
    </button>
  );
};

export default SignOutButton;
