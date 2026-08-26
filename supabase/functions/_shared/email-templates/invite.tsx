/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join Monkey Trucking</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/email-assets/monkey-trucking-logo.png" alt="Monkey Trucking" width="160" height="auto" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}><strong>Monkey Trucking</strong></Link>. Click the button below to accept the invitation and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>Accept Invitation</Button>
        <Text style={footer}>If you weren't expecting this invitation, you can safely ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#6e6e6e', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(0, 100%, 62%)', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
