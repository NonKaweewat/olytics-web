// UC-04 alternate flow 2-a: cannot connect to Amazon Redshift.
export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="alert" role="alert">
      <strong>ไม่สามารถเชื่อมต่อกับ Amazon Redshift ได้</strong>
      Cannot load data from the warehouse. Check that the cluster is running, its security group allows port 5439
      from this EC2 instance, and the connection settings are correct.
      <div style={{ marginTop: 8 }}>
        <code>{message}</code>
      </div>
    </div>
  );
}
