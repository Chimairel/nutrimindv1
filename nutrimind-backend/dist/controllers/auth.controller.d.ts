import { Request, Response } from 'express';
export declare class AuthController {
    /**
     * Endpoint handler to register a new user account.
     */
    static register(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Endpoint handler to authenticate and log in a user.
     */
    static login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Endpoint handler to verify and refresh an access token.
     */
    static refresh(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Endpoint handler to securely log out a session.
     */
    static logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export default AuthController;
//# sourceMappingURL=auth.controller.d.ts.map